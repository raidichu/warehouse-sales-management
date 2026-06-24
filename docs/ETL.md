# ETL & Data Warehouse Design
# Tài liệu Thiết kế ETL & Kho Dữ liệu Phân tích — WSMS v1.0

**Document ID:** WSMS-ETL-v1.0  
**Version:** 1.0  
**Date:** 2026-06-23  
**Liên quan:** [DATABASE.md](./DATABASE.md) | [ARCHITECTURE.md](./ARCHITECTURE.md)

---

## Table of Contents

1. [Tổng quan kiến trúc ETL](#1-tổng-quan-kiến-trúc-etl)
2. [Tech Stack ETL](#2-tech-stack-etl)
3. [Data Warehouse Schema (Star Schema)](#3-data-warehouse-schema-star-schema)
4. [dbt Project Structure](#4-dbt-project-structure)
5. [dbt Models](#5-dbt-models)
6. [ETL Pipeline & Scheduling](#6-etl-pipeline--scheduling)
7. [Sequence Diagram ETL](#7-sequence-diagram-etl)
8. [BI Tool — Metabase Setup](#8-bi-tool--metabase-setup)
9. [Monitoring & Alerting](#9-monitoring--alerting)
10. [Development Setup](#10-development-setup)

---

## 1. Tổng quan kiến trúc ETL

### 1.1 Vấn đề

WSMS operational database (OLTP) được tối ưu cho **ghi/đọc giao dịch nhanh** (nhiều bảng normalize, FK, index theo row). Các truy vấn phân tích (báo cáo doanh thu theo tháng, top sản phẩm, xu hướng tồn kho) yêu cầu **JOIN nhiều bảng + aggregation lớn** — chạy trực tiếp trên OLTP sẽ chậm và ảnh hưởng hiệu năng hệ thống chính.

**Giải pháp:** Xây dựng **Analytics Schema** riêng (OLAP) theo mô hình Star Schema, dữ liệu được đồng bộ định kỳ bằng pipeline ETL.

### 1.2 Kiến trúc tổng quan

```
┌─────────────────────────────────────────────────────────────────────┐
│              WSMS PostgreSQL (cùng 1 instance)                      │
│                                                                     │
│  ┌───────────────────────┐     ETL (dbt)      ┌──────────────────┐ │
│  │   Schema: public      │ ──────────────────> │ Schema: staging  │ │
│  │   (OLTP — operational)│                    │ (dbt staging)    │ │
│  │                       │                    └────────┬─────────┘ │
│  │ products              │                             │            │
│  │ inventory             │                    ┌────────▼─────────┐ │
│  │ stock_transactions    │                    │ Schema: analytics│ │
│  │ sales_orders          │                    │ (OLAP — Star     │ │
│  │ invoices              │                    │  Schema)         │ │
│  │ purchase_orders       │                    │                  │ │
│  │ ...                   │                    │ dim_date         │ │
│  └───────────────────────┘                    │ dim_product      │ │
│                                               │ dim_customer     │ │
│                                               │ fact_sales       │ │
│                                               │ fact_inventory   │ │
│                                               │ ...              │ │
│                                               └──────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                         ┌──────────▼──────────┐
                         │      Metabase        │
                         │  (BI Dashboard)      │
                         │  Port 3001           │
                         └─────────────────────┘
```

**Lý do dùng cùng PostgreSQL instance** (thay vì database riêng):
- Đơn giản, không cần network hop giữa 2 DB.
- `dbt` có thể đọc trực tiếp từ `public` schema và ghi vào `analytics` schema.
- Phân tách vẫn rõ ràng qua schema — DBA có thể grant quyền read-only cho Metabase chỉ trên schema `analytics`.
- Nếu sau này cần tách ra database riêng (khi volume lớn), chỉ cần thay đổi dbt profile.

### 1.3 Phạm vi ETL

| Domain | Bảng nguồn (OLTP) | Mô hình đích (OLAP) |
|--------|-------------------|---------------------|
| Tồn kho | `inventory`, `stock_transactions` | `fact_inventory_daily`, `fact_stock_movements` |
| Bán hàng | `invoices`, `invoice_lines`, `sales_orders` | `fact_sales` |
| Mua hàng | `goods_receipt_notes`, `goods_receipt_lines` | `fact_purchases` |
| Công nợ | `accounts_receivable`, `accounts_payable` | `fact_ar_aging`, `fact_ap_aging` |
| Dimensions | `products`, `customers`, `suppliers`, `warehouses`, `users` | `dim_*` |
| Thời gian | Tự tạo | `dim_date` |

---

## 2. Tech Stack ETL

| Thành phần | Công nghệ | Lý do chọn |
|------------|-----------|------------|
| **Transform** | [dbt Core](https://docs.getdbt.com/) v1.7 | SQL-based transforms, version control, test tích hợp, tài liệu tự sinh |
| **Orchestration** | Cron + shell script (đơn giản) / Apache Airflow (nếu cần phức tạp) | Cron đủ cho SME; Airflow khi có dependency phức tạp |
| **Connector** | Native PostgreSQL (dbt-postgres adapter) | ETL trong cùng DB instance, không cần connector ngoài |
| **BI Tool** | [Metabase](https://www.metabase.com/) Community (self-hosted) | Miễn phí, giao diện thân thiện, hỗ trợ SQL + no-code |
| **Testing** | dbt tests (generic + singular) | Schema tests, freshness tests tích hợp sẵn |

---

## 3. Data Warehouse Schema (Star Schema)

### 3.1 Diagram

```
                    ┌─────────────┐
                    │  dim_date   │
                    └──────┬──────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
   ┌──────┴──────┐  ┌──────┴──────┐  ┌─────┴───────┐
   │ dim_product │  │dim_customer │  │dim_supplier │
   └──────┬──────┘  └──────┬──────┘  └─────┬───────┘
          │                │                │
          └────────────────┼────────────────┘
                           │
              ┌────────────┼─────────────┐
              │            │             │
       ┌──────┴──┐  ┌──────┴──┐  ┌──────┴──┐
       │fact_    │  │fact_    │  │fact_    │
       │sales    │  │purchases│  │inventory│
       │         │  │         │  │_daily   │
       └─────────┘  └─────────┘  └─────────┘
```

### 3.2 Dimension Tables

#### `analytics.dim_date`

```sql
CREATE TABLE analytics.dim_date (
    date_id         INTEGER     PRIMARY KEY,  -- YYYYMMDD (ví dụ: 20260623)
    date_actual     DATE        NOT NULL,
    day_of_week     SMALLINT    NOT NULL,     -- 1=Mon, 7=Sun
    day_name        VARCHAR(10) NOT NULL,     -- 'Thứ 2', 'Thứ 3', ...
    day_of_month    SMALLINT    NOT NULL,
    day_of_year     SMALLINT    NOT NULL,
    week_of_year    SMALLINT    NOT NULL,
    month_actual    SMALLINT    NOT NULL,
    month_name      VARCHAR(20) NOT NULL,     -- 'Tháng 1', 'Tháng 2', ...
    month_name_abbr VARCHAR(5)  NOT NULL,
    quarter_actual  SMALLINT    NOT NULL,     -- 1, 2, 3, 4
    quarter_name    VARCHAR(10) NOT NULL,     -- 'Q1-2026'
    year_actual     SMALLINT    NOT NULL,
    is_weekend      BOOLEAN     NOT NULL,
    is_holiday_vn   BOOLEAN     NOT NULL DEFAULT FALSE
);
```

> `dim_date` được seed một lần cho range 2020–2030, không cần ETL hàng ngày.

#### `analytics.dim_product`

```sql
CREATE TABLE analytics.dim_product (
    product_key     SERIAL      PRIMARY KEY,
    product_id      UUID        NOT NULL,           -- NK từ OLTP
    sku             VARCHAR(50) NOT NULL,
    product_name    VARCHAR(200) NOT NULL,
    category_id     UUID,
    category_name   VARCHAR(200),
    parent_category VARCHAR(200),
    base_uom_name   VARCHAR(100),
    sale_price      NUMERIC(18, 2),
    purchase_price  NUMERIC(18, 2),
    min_stock_qty   NUMERIC(15, 4),
    is_active       BOOLEAN,
    dbt_updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `analytics.dim_customer`

```sql
CREATE TABLE analytics.dim_customer (
    customer_key    SERIAL      PRIMARY KEY,
    customer_id     UUID        NOT NULL,
    customer_code   VARCHAR(20),
    customer_name   VARCHAR(200) NOT NULL,
    customer_group  VARCHAR(50),
    credit_limit    NUMERIC(18, 2),
    payment_term_days INTEGER,
    is_active       BOOLEAN,
    dbt_updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `analytics.dim_supplier`

```sql
CREATE TABLE analytics.dim_supplier (
    supplier_key    SERIAL      PRIMARY KEY,
    supplier_id     UUID        NOT NULL,
    supplier_code   VARCHAR(20),
    supplier_name   VARCHAR(200) NOT NULL,
    payment_term_days INTEGER,
    is_active       BOOLEAN,
    dbt_updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `analytics.dim_warehouse`

```sql
CREATE TABLE analytics.dim_warehouse (
    warehouse_key   SERIAL      PRIMARY KEY,
    warehouse_id    UUID        NOT NULL,
    warehouse_code  VARCHAR(20),
    warehouse_name  VARCHAR(200) NOT NULL,
    is_active       BOOLEAN,
    dbt_updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `analytics.dim_user`

```sql
CREATE TABLE analytics.dim_user (
    user_key        SERIAL      PRIMARY KEY,
    user_id         UUID        NOT NULL,
    full_name       VARCHAR(200) NOT NULL,
    email           VARCHAR(200),
    is_active       BOOLEAN,
    dbt_updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 3.3 Fact Tables

#### `analytics.fact_sales` — Grain: 1 dòng = 1 dòng hóa đơn (invoice line)

```sql
CREATE TABLE analytics.fact_sales (
    sale_key            BIGSERIAL   PRIMARY KEY,
    -- Dimensions (surrogate keys)
    date_id             INTEGER     NOT NULL REFERENCES analytics.dim_date(date_id),
    product_key         INTEGER     NOT NULL REFERENCES analytics.dim_product(product_key),
    customer_key        INTEGER     NOT NULL REFERENCES analytics.dim_customer(customer_key),
    warehouse_key       INTEGER     NOT NULL REFERENCES analytics.dim_warehouse(warehouse_key),
    salesperson_key     INTEGER     REFERENCES analytics.dim_user(user_key),
    -- Natural keys (để trace về OLTP)
    invoice_id          UUID        NOT NULL,
    invoice_number      VARCHAR(30),
    invoice_line_id     UUID        NOT NULL,
    sales_order_id      UUID,
    so_number           VARCHAR(30),
    -- Measures
    quantity            NUMERIC(15, 4) NOT NULL,
    unit_price          NUMERIC(18, 4) NOT NULL,
    discount_pct        NUMERIC(5, 2)  NOT NULL DEFAULT 0,
    tax_rate            NUMERIC(5, 2)  NOT NULL DEFAULT 0,
    subtotal_before_tax NUMERIC(18, 2) NOT NULL,
    tax_amount          NUMERIC(18, 2) NOT NULL,
    subtotal_after_tax  NUMERIC(18, 2) NOT NULL,
    unit_cost           NUMERIC(18, 4) NOT NULL DEFAULT 0,  -- avg_cost tại thời điểm xuất
    cogs                NUMERIC(18, 2) NOT NULL DEFAULT 0,  -- cost of goods sold
    gross_profit        NUMERIC(18, 2) GENERATED ALWAYS AS (subtotal_after_tax - cogs) STORED,
    -- ETL metadata
    dbt_loaded_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `analytics.fact_purchases` — Grain: 1 dòng = 1 dòng GRN (goods receipt line)

```sql
CREATE TABLE analytics.fact_purchases (
    purchase_key        BIGSERIAL   PRIMARY KEY,
    date_id             INTEGER     NOT NULL REFERENCES analytics.dim_date(date_id),
    product_key         INTEGER     NOT NULL REFERENCES analytics.dim_product(product_key),
    supplier_key        INTEGER     NOT NULL REFERENCES analytics.dim_supplier(supplier_key),
    warehouse_key       INTEGER     NOT NULL REFERENCES analytics.dim_warehouse(warehouse_key),
    -- Natural keys
    grn_id              UUID        NOT NULL,
    grn_number          VARCHAR(30),
    grn_line_id         UUID        NOT NULL,
    po_id               UUID,
    po_number           VARCHAR(30),
    -- Measures
    qty_received        NUMERIC(15, 4) NOT NULL,
    unit_price          NUMERIC(18, 4) NOT NULL,
    tax_rate            NUMERIC(5, 2)  NOT NULL DEFAULT 0,
    subtotal_before_tax NUMERIC(18, 2) NOT NULL,
    tax_amount          NUMERIC(18, 2) NOT NULL,
    total_cost          NUMERIC(18, 2) NOT NULL,
    dbt_loaded_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `analytics.fact_inventory_daily` — Grain: 1 dòng = 1 sản phẩm × 1 kho × 1 ngày

```sql
CREATE TABLE analytics.fact_inventory_daily (
    inventory_daily_key BIGSERIAL   PRIMARY KEY,
    date_id             INTEGER     NOT NULL REFERENCES analytics.dim_date(date_id),
    product_key         INTEGER     NOT NULL REFERENCES analytics.dim_product(product_key),
    warehouse_key       INTEGER     NOT NULL REFERENCES analytics.dim_warehouse(warehouse_key),
    -- Measures (snapshot cuối ngày)
    quantity_eod        NUMERIC(15, 4) NOT NULL DEFAULT 0,  -- tồn cuối ngày
    reserved_qty_eod    NUMERIC(15, 4) NOT NULL DEFAULT 0,
    available_qty_eod   NUMERIC(15, 4) GENERATED ALWAYS AS (quantity_eod - reserved_qty_eod) STORED,
    avg_cost_eod        NUMERIC(18, 4) NOT NULL DEFAULT 0,
    stock_value_eod     NUMERIC(18, 2) GENERATED ALWAYS AS (quantity_eod * avg_cost_eod) STORED,
    -- Movements trong ngày
    qty_received        NUMERIC(15, 4) NOT NULL DEFAULT 0,
    qty_issued          NUMERIC(15, 4) NOT NULL DEFAULT 0,
    qty_sold            NUMERIC(15, 4) NOT NULL DEFAULT 0,
    qty_purchased       NUMERIC(15, 4) NOT NULL DEFAULT 0,
    dbt_loaded_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_inv_daily UNIQUE (date_id, product_key, warehouse_key)
);
```

#### `analytics.fact_stock_movements` — Grain: 1 dòng = 1 StockTransaction

```sql
CREATE TABLE analytics.fact_stock_movements (
    movement_key        BIGSERIAL   PRIMARY KEY,
    date_id             INTEGER     NOT NULL REFERENCES analytics.dim_date(date_id),
    product_key         INTEGER     NOT NULL REFERENCES analytics.dim_product(product_key),
    warehouse_key       INTEGER     NOT NULL REFERENCES analytics.dim_warehouse(warehouse_key),
    -- Natural keys
    transaction_id      UUID        NOT NULL UNIQUE,
    transaction_type    VARCHAR(50) NOT NULL,
    ref_type            VARCHAR(50),
    ref_number          VARCHAR(50),
    -- Measures
    quantity_in         NUMERIC(15, 4) NOT NULL DEFAULT 0,
    quantity_out        NUMERIC(15, 4) NOT NULL DEFAULT 0,
    unit_cost           NUMERIC(18, 4) NOT NULL DEFAULT 0,
    total_cost          NUMERIC(18, 2) NOT NULL DEFAULT 0,
    dbt_loaded_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `analytics.fact_ar_aging` — Grain: 1 dòng = 1 AR record × ngày snapshot

```sql
CREATE TABLE analytics.fact_ar_aging (
    ar_aging_key        BIGSERIAL   PRIMARY KEY,
    snapshot_date_id    INTEGER     NOT NULL REFERENCES analytics.dim_date(date_id),
    customer_key        INTEGER     NOT NULL REFERENCES analytics.dim_customer(customer_key),
    -- Natural keys
    ar_id               UUID        NOT NULL,
    invoice_number      VARCHAR(30),
    -- Measures
    amount_total        NUMERIC(18, 2) NOT NULL,
    amount_paid         NUMERIC(18, 2) NOT NULL,
    amount_remaining    NUMERIC(18, 2) NOT NULL,
    days_overdue        INTEGER     NOT NULL DEFAULT 0,
    -- Aging buckets
    bucket_not_due      NUMERIC(18, 2) NOT NULL DEFAULT 0,
    bucket_1_30         NUMERIC(18, 2) NOT NULL DEFAULT 0,
    bucket_31_60        NUMERIC(18, 2) NOT NULL DEFAULT 0,
    bucket_61_90        NUMERIC(18, 2) NOT NULL DEFAULT 0,
    bucket_over_90      NUMERIC(18, 2) NOT NULL DEFAULT 0,
    dbt_loaded_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_ar_aging UNIQUE (snapshot_date_id, ar_id)
);
```

#### `analytics.fact_ap_aging` — Grain: tương tự AR nhưng cho nhà cung cấp

```sql
CREATE TABLE analytics.fact_ap_aging (
    ap_aging_key        BIGSERIAL   PRIMARY KEY,
    snapshot_date_id    INTEGER     NOT NULL REFERENCES analytics.dim_date(date_id),
    supplier_key        INTEGER     NOT NULL REFERENCES analytics.dim_supplier(supplier_key),
    ap_id               UUID        NOT NULL,
    grn_number          VARCHAR(30),
    amount_total        NUMERIC(18, 2) NOT NULL,
    amount_paid         NUMERIC(18, 2) NOT NULL,
    amount_remaining    NUMERIC(18, 2) NOT NULL,
    days_overdue        INTEGER     NOT NULL DEFAULT 0,
    bucket_not_due      NUMERIC(18, 2) NOT NULL DEFAULT 0,
    bucket_1_30         NUMERIC(18, 2) NOT NULL DEFAULT 0,
    bucket_31_60        NUMERIC(18, 2) NOT NULL DEFAULT 0,
    bucket_61_90        NUMERIC(18, 2) NOT NULL DEFAULT 0,
    bucket_over_90      NUMERIC(18, 2) NOT NULL DEFAULT 0,
    dbt_loaded_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_ap_aging UNIQUE (snapshot_date_id, ap_id)
);
```

---

## 4. dbt Project Structure

```
etl/
├── dbt_project.yml              # Cấu hình dbt project
├── profiles.yml                 # Connection profiles (không commit — dùng env vars)
├── packages.yml                 # dbt packages (dbt-utils, ...)
│
├── models/
│   ├── staging/                 # Layer 1: Đọc từ OLTP, chuẩn hóa tên cột
│   │   ├── stg_products.sql
│   │   ├── stg_customers.sql
│   │   ├── stg_suppliers.sql
│   │   ├── stg_warehouses.sql
│   │   ├── stg_users.sql
│   │   ├── stg_invoices.sql
│   │   ├── stg_invoice_lines.sql
│   │   ├── stg_goods_receipt_notes.sql
│   │   ├── stg_goods_receipt_lines.sql
│   │   ├── stg_stock_transactions.sql
│   │   ├── stg_accounts_receivable.sql
│   │   ├── stg_accounts_payable.sql
│   │   └── _staging.yml         # Source definitions + freshness tests
│   │
│   ├── intermediate/            # Layer 2: Business logic phức tạp
│   │   ├── int_sales_enriched.sql       # Invoice lines + cost + customer info
│   │   ├── int_purchases_enriched.sql   # GRN lines + supplier info
│   │   ├── int_inventory_movements.sql  # Stock txn phân loại in/out
│   │   └── int_ar_with_aging.sql        # AR + tính aging buckets
│   │
│   └── marts/                   # Layer 3: Fact + Dim tables cuối cùng
│       ├── dimensions/
│       │   ├── dim_date.sql
│       │   ├── dim_product.sql
│       │   ├── dim_customer.sql
│       │   ├── dim_supplier.sql
│       │   ├── dim_warehouse.sql
│       │   └── dim_user.sql
│       └── facts/
│           ├── fact_sales.sql
│           ├── fact_purchases.sql
│           ├── fact_inventory_daily.sql
│           ├── fact_stock_movements.sql
│           ├── fact_ar_aging.sql
│           └── fact_ap_aging.sql
│
├── seeds/                       # Static data
│   └── dim_date_seed.csv        # Calendar 2020–2035 (chạy 1 lần)
│
├── tests/                       # Singular tests (custom SQL assertions)
│   ├── assert_inventory_not_negative.sql
│   ├── assert_fact_sales_amounts_positive.sql
│   └── assert_ar_aging_buckets_sum.sql
│
├── macros/                      # Jinja macros tái sử dụng
│   ├── generate_surrogate_key.sql
│   ├── get_date_id.sql          -- convert DATE → YYYYMMDD integer
│   └── aging_bucket.sql         -- tính aging bucket từ days_overdue
│
└── analyses/                    # Ad-hoc SQL queries (không materialize)
    ├── monthly_revenue_trend.sql
    └── top_customers_by_revenue.sql
```

---

## 5. dbt Models

### 5.1 `dbt_project.yml`

```yaml
name: 'wsms_etl'
version: '1.0.0'
config-version: 2

profile: 'wsms'

model-paths: ["models"]
seed-paths: ["seeds"]
test-paths: ["tests"]
macro-paths: ["macros"]

models:
  wsms_etl:
    staging:
      +materialized: view          # Staging = views (không tốn dung lượng)
      +schema: staging
    intermediate:
      +materialized: view
      +schema: staging
    marts:
      dimensions:
        +materialized: table       # Dimensions = tables (query nhanh)
        +schema: analytics
      facts:
        +materialized: incremental # Facts = incremental (chỉ thêm dữ liệu mới)
        +schema: analytics
        +unique_key: [surrogate_key_column]

vars:
  wsms_start_date: '2026-01-01'   # Ngày bắt đầu load dữ liệu
```

### 5.2 `profiles.yml`

```yaml
# ~/.dbt/profiles.yml (KHÔNG commit file này)
wsms:
  target: prod
  outputs:
    dev:
      type: postgres
      host: localhost
      port: 5432
      user: "{{ env_var('DBT_DB_USER') }}"
      password: "{{ env_var('DBT_DB_PASSWORD') }}"
      dbname: wsms_dev
      schema: analytics      # target schema mặc định
      threads: 4
    prod:
      type: postgres
      host: "{{ env_var('DBT_DB_HOST') }}"
      port: 5432
      user: "{{ env_var('DBT_DB_USER') }}"
      password: "{{ env_var('DBT_DB_PASSWORD') }}"
      dbname: wsms_prod
      schema: analytics
      threads: 4
```

### 5.3 Staging Model — `stg_invoices.sql`

```sql
-- models/staging/stg_invoices.sql
-- Đọc từ bảng OLTP invoices, chuẩn hóa và lọc chỉ lấy 'confirmed'

WITH source AS (
    SELECT * FROM {{ source('wsms_public', 'invoices') }}
),

renamed AS (
    SELECT
        id                  AS invoice_id,
        invoice_number,
        so_id               AS sales_order_id,
        customer_id,
        status,
        invoice_date,
        due_date,
        subtotal            AS subtotal_before_tax,
        tax_amount,
        grand_total         AS subtotal_after_tax,
        created_by          AS salesperson_id,
        created_at
    FROM source
    WHERE status = 'confirmed'   -- chỉ load hóa đơn đã xác nhận
)

SELECT * FROM renamed
```

### 5.4 Staging Source Definition — `_staging.yml`

```yaml
# models/staging/_staging.yml
version: 2

sources:
  - name: wsms_public
    description: "WSMS operational database (public schema)"
    database: wsms_prod
    schema: public
    freshness:
      warn_after: {count: 24, period: hour}
      error_after: {count: 48, period: hour}
    loaded_at_field: updated_at

    tables:
      - name: invoices
        description: "Hóa đơn bán hàng"
        loaded_at_field: updated_at
        columns:
          - name: id
            tests: [unique, not_null]
          - name: customer_id
            tests: [not_null]
          - name: status
            tests:
              - accepted_values:
                  values: ['draft', 'confirmed', 'partially_paid', 'paid', 'cancelled']

      - name: stock_transactions
        description: "Giao dịch kho"
        loaded_at_field: created_at
        columns:
          - name: id
            tests: [unique, not_null]
          - name: type
            tests: [not_null]

      - name: products
        columns:
          - name: id
            tests: [unique, not_null]
          - name: sku
            tests: [unique, not_null]

      # ... thêm các bảng nguồn khác
```

### 5.5 Intermediate Model — `int_sales_enriched.sql`

```sql
-- models/intermediate/int_sales_enriched.sql

WITH invoice_lines AS (
    SELECT * FROM {{ ref('stg_invoice_lines') }}
),

invoices AS (
    SELECT * FROM {{ ref('stg_invoices') }}
),

-- Lấy avg_cost tại thời điểm xuất kho (từ GDN line)
delivery_costs AS (
    SELECT
        so_line_id,
        product_id,
        AVG(unit_cost) AS avg_unit_cost   -- cost tại thời điểm giao hàng
    FROM {{ ref('stg_goods_delivery_lines') }}
    GROUP BY so_line_id, product_id
),

final AS (
    SELECT
        il.invoice_line_id,
        il.invoice_id,
        i.invoice_number,
        i.invoice_date,
        i.sales_order_id,
        i.customer_id,
        i.salesperson_id,
        il.product_id,
        il.quantity,
        il.unit_price,
        il.discount_pct,
        il.tax_rate,
        il.subtotal                                             AS subtotal_before_tax,
        ROUND(il.subtotal * il.tax_rate / 100, 2)              AS tax_amount,
        ROUND(il.subtotal * (1 + il.tax_rate / 100), 2)        AS subtotal_after_tax,
        COALESCE(dc.avg_unit_cost, 0)                          AS unit_cost,
        ROUND(il.quantity * COALESCE(dc.avg_unit_cost, 0), 2)  AS cogs
    FROM invoice_lines il
    INNER JOIN invoices i ON i.invoice_id = il.invoice_id
    LEFT JOIN delivery_costs dc
        ON dc.so_line_id = il.so_line_id
        AND dc.product_id = il.product_id
)

SELECT * FROM final
```

### 5.6 Fact Model — `fact_sales.sql`

```sql
-- models/marts/facts/fact_sales.sql
-- Materialization: incremental (chỉ load hóa đơn mới sau lần chạy trước)

{{
  config(
    materialized='incremental',
    unique_key='invoice_line_id',
    incremental_strategy='merge',
    on_schema_change='sync_all_columns'
  )
}}

WITH enriched AS (
    SELECT * FROM {{ ref('int_sales_enriched') }}

    {% if is_incremental() %}
    -- Chỉ lấy records mới hơn lần ETL trước (incremental load)
    WHERE invoice_date >= (SELECT MAX(invoice_date) FROM {{ this }}) - INTERVAL '1 day'
    {% endif %}
),

dim_product AS (SELECT * FROM {{ ref('dim_product') }}),
dim_customer AS (SELECT * FROM {{ ref('dim_customer') }}),
dim_warehouse AS (SELECT * FROM {{ ref('dim_warehouse') }}),
dim_user AS (SELECT * FROM {{ ref('dim_user') }}),

final AS (
    SELECT
        {{ dbt_utils.generate_surrogate_key(['e.invoice_line_id']) }} AS sale_key,
        {{ get_date_id('e.invoice_date') }}                            AS date_id,
        dp.product_key,
        dc.customer_key,
        dw.warehouse_key,
        du.user_key                                                    AS salesperson_key,
        e.invoice_id,
        e.invoice_number,
        e.invoice_line_id,
        e.sales_order_id,
        NULL::VARCHAR(30)                                              AS so_number,
        e.quantity,
        e.unit_price,
        e.discount_pct,
        e.tax_rate,
        e.subtotal_before_tax,
        e.tax_amount,
        e.subtotal_after_tax,
        e.unit_cost,
        e.cogs,
        NOW()                                                          AS dbt_loaded_at
    FROM enriched e
    LEFT JOIN dim_product dp  ON dp.product_id  = e.product_id
    LEFT JOIN dim_customer dc ON dc.customer_id = e.customer_id
    LEFT JOIN dim_warehouse dw ON dw.warehouse_id = (
        SELECT warehouse_id FROM {{ source('wsms_public', 'sales_orders') }}
        WHERE id = e.sales_order_id LIMIT 1
    )
    LEFT JOIN dim_user du ON du.user_id = e.salesperson_id
)

SELECT * FROM final
```

### 5.7 Fact Model — `fact_inventory_daily.sql`

```sql
-- models/marts/facts/fact_inventory_daily.sql
-- Snapshot tồn kho cuối mỗi ngày

{{
  config(
    materialized='incremental',
    unique_key=['date_id', 'product_key', 'warehouse_key'],
    incremental_strategy='merge'
  )
}}

WITH daily_movements AS (
    SELECT
        DATE(transaction_date)          AS txn_date,
        product_id,
        warehouse_id,
        SUM(CASE WHEN quantity > 0 THEN quantity ELSE 0 END)  AS qty_in,
        SUM(CASE WHEN quantity < 0 THEN ABS(quantity) ELSE 0 END) AS qty_out,
        SUM(CASE WHEN type = 'SALE_DELIVERY' THEN ABS(quantity) ELSE 0 END) AS qty_sold,
        SUM(CASE WHEN type = 'PURCHASE_RECEIPT' THEN quantity ELSE 0 END)   AS qty_purchased
    FROM {{ source('wsms_public', 'stock_transactions') }}

    {% if is_incremental() %}
    WHERE transaction_date >= (
        SELECT date_actual FROM analytics.dim_date
        WHERE date_id = (SELECT MAX(date_id) FROM {{ this }})
    ) - INTERVAL '1 day'
    {% endif %}

    GROUP BY DATE(transaction_date), product_id, warehouse_id
),

inventory_snapshot AS (
    SELECT
        product_id,
        warehouse_id,
        quantity            AS quantity_eod,
        reserved_qty        AS reserved_qty_eod,
        avg_cost            AS avg_cost_eod,
        DATE(updated_at)    AS snapshot_date
    FROM {{ source('wsms_public', 'inventory') }}
),

dim_product     AS (SELECT * FROM {{ ref('dim_product') }}),
dim_warehouse   AS (SELECT * FROM {{ ref('dim_warehouse') }}),

final AS (
    SELECT
        {{ get_date_id('dm.txn_date') }}  AS date_id,
        dp.product_key,
        dw.warehouse_key,
        COALESCE(inv.quantity_eod, 0)     AS quantity_eod,
        COALESCE(inv.reserved_qty_eod, 0) AS reserved_qty_eod,
        COALESCE(inv.avg_cost_eod, 0)     AS avg_cost_eod,
        dm.qty_in                         AS qty_received,
        dm.qty_out                        AS qty_issued,
        dm.qty_sold,
        dm.qty_purchased,
        NOW()                             AS dbt_loaded_at
    FROM daily_movements dm
    LEFT JOIN inventory_snapshot inv
        ON inv.product_id    = dm.product_id
        AND inv.warehouse_id = dm.warehouse_id
        AND inv.snapshot_date = dm.txn_date
    LEFT JOIN dim_product dp ON dp.product_id    = dm.product_id
    LEFT JOIN dim_warehouse dw ON dw.warehouse_id = dm.warehouse_id
)

SELECT * FROM final
```

### 5.8 Macro — `get_date_id.sql`

```sql
-- macros/get_date_id.sql
{% macro get_date_id(date_column) %}
    CAST(TO_CHAR({{ date_column }}, 'YYYYMMDD') AS INTEGER)
{% endmacro %}
```

### 5.9 dbt Tests — `assert_inventory_not_negative.sql`

```sql
-- tests/assert_inventory_not_negative.sql
-- Test: quantity_eod không được âm (trừ khi cấu hình cho phép)
SELECT
    date_id,
    product_key,
    warehouse_key,
    quantity_eod
FROM {{ ref('fact_inventory_daily') }}
WHERE quantity_eod < -0.0001   -- tolerance nhỏ cho floating point
```

---

## 6. ETL Pipeline & Scheduling

### 6.1 Lịch chạy ETL

| Job | Lịch | Thời gian ước tính | Mô tả |
|-----|------|-------------------|-------|
| `dbt run --select staging` | Mỗi giờ | ~30 giây | Refresh staging views (không thực sự chạy, chỉ định nghĩa views) |
| `dbt run --select marts.facts` | Hàng ngày 01:00 | ~2–5 phút | Load incremental facts |
| `dbt run --select marts.dimensions` | Hàng ngày 00:30 | ~1 phút | Refresh dimensions |
| `dbt snapshot` | Hàng ngày 00:00 | ~1 phút | SCD snapshot nếu cần |
| `dbt test` | Sau mỗi lần `dbt run` | ~1 phút | Kiểm tra chất lượng dữ liệu |
| `dbt source freshness` | Mỗi 6 giờ | ~10 giây | Kiểm tra nguồn dữ liệu còn fresh |

### 6.2 Crontab Setup (Linux/VPS)

```bash
# Mở crontab
crontab -e

# Thêm các dòng sau:

# 00:30 — Refresh dimensions
30 0 * * * cd /opt/wsms-etl && /opt/venv/bin/dbt run --select marts.dimensions --profiles-dir . >> /var/log/wsms-etl/dimensions.log 2>&1

# 01:00 — Load facts incremental
0 1 * * * cd /opt/wsms-etl && /opt/venv/bin/dbt run --select marts.facts --profiles-dir . >> /var/log/wsms-etl/facts.log 2>&1

# 01:30 — Run tests
30 1 * * * cd /opt/wsms-etl && /opt/venv/bin/dbt test --profiles-dir . >> /var/log/wsms-etl/tests.log 2>&1

# 06:00, 12:00, 18:00 — Source freshness check
0 6,12,18 * * * cd /opt/wsms-etl && /opt/venv/bin/dbt source freshness --profiles-dir . >> /var/log/wsms-etl/freshness.log 2>&1
```

### 6.3 ETL Shell Script (`run_etl.sh`)

```bash
#!/bin/bash
# /opt/wsms-etl/run_etl.sh
# Script ETL đầy đủ — chạy thủ công hoặc qua cron

set -e  # Dừng nếu có lỗi

LOG_DIR="/var/log/wsms-etl"
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
LOG_FILE="$LOG_DIR/etl_$TIMESTAMP.log"

# Load environment variables
source /opt/wsms-etl/.env

echo "[$TIMESTAMP] Bắt đầu ETL pipeline..." | tee -a "$LOG_FILE"

# 1. Kiểm tra kết nối database
echo "[Step 1] Kiểm tra kết nối DB..." | tee -a "$LOG_FILE"
dbt debug --profiles-dir . >> "$LOG_FILE" 2>&1

# 2. Kiểm tra freshness nguồn dữ liệu
echo "[Step 2] Kiểm tra freshness..." | tee -a "$LOG_FILE"
dbt source freshness --profiles-dir . >> "$LOG_FILE" 2>&1

# 3. Chạy dimensions trước (facts phụ thuộc)
echo "[Step 3] Load dimensions..." | tee -a "$LOG_FILE"
dbt run --select marts.dimensions --profiles-dir . >> "$LOG_FILE" 2>&1

# 4. Chạy facts incremental
echo "[Step 4] Load facts (incremental)..." | tee -a "$LOG_FILE"
dbt run --select marts.facts --profiles-dir . >> "$LOG_FILE" 2>&1

# 5. Chạy tests
echo "[Step 5] Chạy dbt tests..." | tee -a "$LOG_FILE"
dbt test --profiles-dir . >> "$LOG_FILE" 2>&1

# 6. Gửi email thông báo (nếu SMTP đã cấu hình)
if [ $? -eq 0 ]; then
    echo "[Step 6] ETL hoàn thành ✓" | tee -a "$LOG_FILE"
    # Tùy chọn: gửi email thành công
    # echo "ETL WSMS hoàn thành lúc $(date)" | mail -s "[WSMS ETL] Success" admin@wsms.local
else
    echo "[Step 6] ETL THẤT BẠI — xem log: $LOG_FILE" | tee -a "$LOG_FILE"
    # Tùy chọn: gửi email cảnh báo
    # echo "ETL WSMS thất bại lúc $(date). Log: $LOG_FILE" | mail -s "[WSMS ETL] FAILED" admin@wsms.local
fi
```

### 6.4 Full Refresh (khi cần load lại toàn bộ)

```bash
# Chạy toàn bộ từ đầu (xóa và tạo lại fact tables)
dbt run --full-refresh --profiles-dir .

# Chỉ full refresh 1 model cụ thể
dbt run --select fact_sales --full-refresh --profiles-dir .
```

---

## 7. Sequence Diagram ETL

```mermaid
sequenceDiagram
    participant Cron as Cron Scheduler
    participant Script as run_etl.sh
    participant dbt as dbt Core
    participant OLTP as PostgreSQL (public)
    participant DW as PostgreSQL (analytics)
    participant Alert as Email Alert

    Cron->>Script: Trigger 01:00 hàng ngày
    Script->>dbt: dbt source freshness

    dbt->>OLTP: SELECT MAX(updated_at) FROM invoices, stock_transactions, ...
    OLTP-->>dbt: last updated timestamps
    dbt-->>Script: OK (hoặc WARN nếu data cũ > 24h)

    Script->>dbt: dbt run --select marts.dimensions
    loop Mỗi dimension model
        dbt->>OLTP: SELECT từ bảng nguồn (products, customers, ...)
        OLTP-->>dbt: rows
        dbt->>DW: TRUNCATE + INSERT INTO analytics.dim_*
        DW-->>dbt: OK
    end
    dbt-->>Script: Dimensions loaded

    Script->>dbt: dbt run --select marts.facts
    loop Mỗi fact model (incremental)
        dbt->>DW: SELECT MAX(date_id) FROM analytics.fact_* [watermark]
        DW-->>dbt: last loaded date
        dbt->>OLTP: SELECT ... WHERE date >= last_loaded_date - 1 day
        OLTP-->>dbt: new rows
        dbt->>DW: MERGE INTO analytics.fact_* (upsert by unique_key)
        DW-->>dbt: rows merged
    end
    dbt-->>Script: Facts loaded

    Script->>dbt: dbt test
    dbt->>DW: Run test queries (not_null, unique, custom assertions)
    DW-->>dbt: test results

    alt Tất cả tests pass
        dbt-->>Script: 0 failures
        Script-->>Cron: Exit 0 (success)
    else Có test thất bại
        dbt-->>Script: N failures
        Script->>Alert: Gửi email "[WSMS ETL] FAILED — N test failures"
        Script-->>Cron: Exit 1 (failure)
    end
```

---

## 8. BI Tool — Metabase Setup

### 8.1 Cài đặt Metabase (Docker)

```yaml
# Thêm vào docker-compose.yml

services:
  metabase:
    image: metabase/metabase:latest
    container_name: wsms-metabase
    ports:
      - "3001:3000"
    environment:
      MB_DB_TYPE: postgres
      MB_DB_HOST: postgres
      MB_DB_PORT: 5432
      MB_DB_DBNAME: wsms_metabase   # DB riêng để Metabase lưu metadata
      MB_DB_USER: metabase
      MB_DB_PASS: metabase_pass
    depends_on:
      - postgres
    restart: unless-stopped
```

```bash
# Tạo database cho Metabase internal store
docker exec -it postgres psql -U wsms -c "CREATE DATABASE wsms_metabase;"
docker exec -it postgres psql -U wsms -c "CREATE USER metabase WITH PASSWORD 'metabase_pass';"
docker exec -it postgres psql -U wsms -c "GRANT ALL ON DATABASE wsms_metabase TO metabase;"
```

### 8.2 Kết nối Metabase với Analytics Schema

1. Truy cập `http://localhost:3001`, hoàn thành setup wizard.
2. **Add Database** → PostgreSQL:
   - Host: `postgres` (tên service Docker) hoặc IP server
   - Port: `5432`
   - Database: `wsms_prod`
   - Username: `metabase_reader` (read-only user)
   - Password: `***`
   - **Schemas**: chọn chỉ `analytics` (không cho Metabase truy cập `public`)

```sql
-- Tạo read-only user cho Metabase
CREATE USER metabase_reader WITH PASSWORD 'readonly_pass';
GRANT CONNECT ON DATABASE wsms_prod TO metabase_reader;
GRANT USAGE ON SCHEMA analytics TO metabase_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA analytics TO metabase_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA analytics
    GRANT SELECT ON TABLES TO metabase_reader;
```

### 8.3 Dashboard gợi ý trong Metabase

| Dashboard | Metrics chính | Nguồn |
|-----------|--------------|-------|
| **Executive Overview** | Doanh thu tháng, lợi nhuận gộp, tồn kho | `fact_sales`, `fact_inventory_daily` |
| **Sales Analysis** | Top sản phẩm, top khách hàng, trend doanh thu | `fact_sales` + `dim_*` |
| **Inventory Health** | Tồn kho theo ngày, turnover rate, hàng sắp hết | `fact_inventory_daily` |
| **Purchase Analysis** | Chi phí mua hàng, top NCC, trend mua hàng | `fact_purchases` |
| **AR/AP Aging** | Công nợ quá hạn, aging buckets, cash flow dự báo | `fact_ar_aging`, `fact_ap_aging` |

---

## 9. Monitoring & Alerting

### 9.1 dbt Artifacts

Sau mỗi lần chạy, dbt sinh ra các file trong `target/`:
- `manifest.json` — metadata toàn bộ models, tests, dependencies
- `run_results.json` — kết quả lần chạy vừa rồi (pass/fail, timing)
- `catalog.json` — schema của tables đã tạo

### 9.2 Script kiểm tra kết quả ETL

```bash
#!/bin/bash
# check_etl_result.sh — đọc run_results.json và báo cáo

RESULT=$(python3 -c "
import json, sys

with open('target/run_results.json') as f:
    results = json.load(f)

failures = [r for r in results['results'] if r['status'] == 'fail']
errors   = [r for r in results['results'] if r['status'] == 'error']

print(f'Total: {len(results[\"results\"])}')
print(f'Pass:  {len(results[\"results\"]) - len(failures) - len(errors)}')
print(f'Fail:  {len(failures)}')
print(f'Error: {len(errors)}')

if failures or errors:
    print('\\nFailed models/tests:')
    for r in failures + errors:
        print(f'  - {r[\"unique_id\"]} ({r[\"status\"]})')
    sys.exit(1)
")

echo "$RESULT"
```

### 9.3 Kiểm tra ETL thủ công

```bash
# Xem tóm tắt lần chạy cuối
dbt run-results

# Xem row count các fact tables sau ETL
psql $DATABASE_URL -c "
SELECT
    'fact_sales'           AS table_name, COUNT(*) AS row_count FROM analytics.fact_sales
UNION ALL SELECT 'fact_purchases',        COUNT(*) FROM analytics.fact_purchases
UNION ALL SELECT 'fact_inventory_daily',  COUNT(*) FROM analytics.fact_inventory_daily
UNION ALL SELECT 'fact_stock_movements',  COUNT(*) FROM analytics.fact_stock_movements
UNION ALL SELECT 'fact_ar_aging',         COUNT(*) FROM analytics.fact_ar_aging
UNION ALL SELECT 'fact_ap_aging',         COUNT(*) FROM analytics.fact_ap_aging
ORDER BY table_name;
"

# Kiểm tra dữ liệu mới nhất đã load
psql $DATABASE_URL -c "
SELECT
    'fact_sales' AS tbl, MAX(date_id) AS latest_date_id FROM analytics.fact_sales
UNION ALL
SELECT 'fact_inventory_daily', MAX(date_id) FROM analytics.fact_inventory_daily;
"
```

---

## 10. Development Setup

### 10.1 Cài đặt môi trường

```bash
# 1. Tạo Python virtual environment
python3 -m venv /opt/venv
source /opt/venv/bin/activate

# 2. Cài dbt và adapter PostgreSQL
pip install dbt-postgres dbt-utils

# 3. Clone/tạo dbt project
cd /opt
git clone https://github.com/your-org/warehouse-system.git
cd warehouse-system/etl

# 4. Cấu hình profiles.yml
mkdir -p ~/.dbt
cat > ~/.dbt/profiles.yml << 'EOF'
wsms:
  target: dev
  outputs:
    dev:
      type: postgres
      host: localhost
      port: 5432
      user: wsms
      password: wsms_dev_pass
      dbname: wsms_dev
      schema: analytics
      threads: 2
EOF

# 5. Tạo schemas trong PostgreSQL
psql $DATABASE_URL -c "CREATE SCHEMA IF NOT EXISTS analytics;"
psql $DATABASE_URL -c "CREATE SCHEMA IF NOT EXISTS analytics_staging;"

# 6. Cài packages dbt
dbt deps

# 7. Seed dim_date (chạy 1 lần)
dbt seed --select dim_date_seed

# 8. Run toàn bộ lần đầu (full refresh)
dbt run --full-refresh

# 9. Run tests
dbt test

# 10. Xem documentation
dbt docs generate && dbt docs serve  # Mở http://localhost:8080
```

### 10.2 `packages.yml`

```yaml
packages:
  - package: dbt-labs/dbt_utils
    version: [">=1.0.0", "<2.0.0"]
```

### 10.3 Environment Variables (`.env`)

```env
# Database connection
DATABASE_URL=postgresql://wsms:wsms_dev_pass@localhost:5432/wsms_dev
DBT_DB_HOST=localhost
DBT_DB_USER=wsms
DBT_DB_PASSWORD=wsms_dev_pass

# Alert email (tùy chọn)
ALERT_EMAIL=admin@wsms.local
SMTP_HOST=smtp.gmail.com
```

### 10.4 Cấu trúc thư mục cuối cùng trong repo

```
warehouse-system/
├── SRS.md
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DATABASE.md
│   ├── API.md
│   ├── ADR-001-tech-stack.md
│   └── ETL.md                    ← file này
├── backend/                      # Node.js API
├── frontend/                     # React SPA
└── etl/                          # dbt project
    ├── dbt_project.yml
    ├── packages.yml
    ├── models/
    │   ├── staging/
    │   ├── intermediate/
    │   └── marts/
    ├── seeds/
    │   └── dim_date_seed.csv
    ├── tests/
    ├── macros/
    └── run_etl.sh
```
