# Database Design Document
# Tài liệu Thiết kế Cơ sở Dữ liệu — WSMS v1.0

**Document ID:** WSMS-DB-v1.0  
**Version:** 1.0  
**Date:** 2026-06-23  
**Liên quan:** [SRS.md](../SRS.md) | [ARCHITECTURE.md](./ARCHITECTURE.md)

---

## Table of Contents

1. [Tổng quan](#1-tổng-quan)
2. [Quy ước đặt tên](#2-quy-ước-đặt-tên)
3. [ERD Tổng quan](#3-erd-tổng-quan)
4. [DDL Schema](#4-ddl-schema)
   - 4.1 [Master Data Tables](#41-master-data-tables)
   - 4.2 [Inventory Tables](#42-inventory-tables)
   - 4.3 [Purchase Tables](#43-purchase-tables)
   - 4.4 [Sales Tables](#44-sales-tables)
   - 4.5 [Admin Tables](#45-admin-tables)
5. [Indexes](#5-indexes)
6. [Enumerations](#6-enumerations)
7. [Prisma Schema](#7-prisma-schema)
8. [Migration Strategy](#8-migration-strategy)

---

## 1. Tổng quan

| Thông số | Giá trị |
|----------|---------|
| Database Engine | PostgreSQL 15+ |
| Encoding | UTF-8 |
| Timezone | UTC (hiển thị GMT+7 ở client) |
| Kiểu ID | UUID v4 (gen_random_uuid()) |
| Soft Delete | Dùng cột `is_active` / `status = 'cancelled'`; KHÔNG dùng `deleted_at` |
| Kiểu tiền tệ | NUMERIC(18, 2) — không dùng FLOAT |
| Kiểu số lượng | NUMERIC(15, 4) — hỗ trợ số lẻ (kg, lít) |
| Timestamps | TIMESTAMPTZ (với timezone) |

**Tổng số bảng chính:** 28 bảng

---

## 2. Quy ước đặt tên

| Đối tượng | Quy ước | Ví dụ |
|-----------|---------|-------|
| Tên bảng | snake_case, số nhiều | `purchase_orders`, `stock_transactions` |
| Tên cột | snake_case | `created_at`, `warehouse_id` |
| Khóa chính | `id` (UUID) | `id UUID PRIMARY KEY DEFAULT gen_random_uuid()` |
| Khóa ngoại | `{table_singular}_id` | `product_id`, `warehouse_id` |
| Index | `idx_{table}_{column(s)}` | `idx_products_sku` |
| Unique constraint | `uq_{table}_{column(s)}` | `uq_products_sku` |
| FK constraint | `fk_{table}_{ref_table}` | `fk_products_category` |
| Enum type | `{name}_type` hoặc tên mô tả | `stock_transaction_type` |

---

## 3. ERD Tổng quan

```
MASTER DATA
───────────
product_categories (self-ref tree)
    └──< products >── units_of_measure
                          └──< uom_conversions

products ──< inventory >── warehouses ──< stock_locations
products ──< stock_transactions ────────────────────────────┐
                                                            │
PURCHASE                                                    │
────────                                                    │
suppliers ──< purchase_orders ──< purchase_order_lines      │
                  └──< goods_receipt_notes ──< goods_receipt_lines
                              └──> accounts_payable          │
                              └──> stock_transactions ───────┘

SALES
─────
customers ──< sales_orders ──< sales_order_lines            │
                └──< goods_delivery_notes ──< goods_delivery_lines
                            └──> stock_transactions ─────────┘
                └──< invoices ──< invoice_lines
                        └──> accounts_receivable

ADMIN
─────
users >──< user_roles >──< roles >──< role_permissions >──< permissions
users ──< audit_logs
system_configs
refresh_tokens
```

---

## 4. DDL Schema

### 4.1 Master Data Tables

```sql
-- ─────────────────────────────────────────────
-- EXTENSIONS
-- ─────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- gen_random_uuid()

-- ─────────────────────────────────────────────
-- PRODUCT CATEGORIES
-- ─────────────────────────────────────────────
CREATE TABLE product_categories (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(200) NOT NULL,
    parent_id   UUID        REFERENCES product_categories(id) ON DELETE RESTRICT,
    level       SMALLINT    NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 3),
    sort_order  INTEGER     NOT NULL DEFAULT 0,
    is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE product_categories IS 'Nhóm sản phẩm phân cấp tối đa 3 cấp';

-- ─────────────────────────────────────────────
-- UNITS OF MEASURE
-- ─────────────────────────────────────────────
CREATE TABLE units_of_measure (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100) NOT NULL,
    symbol      VARCHAR(20)  NOT NULL,
    is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_uom_name UNIQUE (name),
    CONSTRAINT uq_uom_symbol UNIQUE (symbol)
);

COMMENT ON TABLE units_of_measure IS 'Đơn vị tính (Cái, Kg, Lít, Thùng, ...)';

-- ─────────────────────────────────────────────
-- UOM CONVERSIONS
-- ─────────────────────────────────────────────
CREATE TABLE uom_conversions (
    id          UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    from_uom_id UUID            NOT NULL REFERENCES units_of_measure(id),
    to_uom_id   UUID            NOT NULL REFERENCES units_of_measure(id),
    factor      NUMERIC(15, 6)  NOT NULL CHECK (factor > 0),
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_uom_conversion UNIQUE (from_uom_id, to_uom_id),
    CONSTRAINT chk_uom_different CHECK (from_uom_id <> to_uom_id)
);

COMMENT ON TABLE uom_conversions IS 'Tỷ lệ quy đổi giữa các đơn vị tính (1 Thùng = 24 Cái)';

-- ─────────────────────────────────────────────
-- PRODUCTS
-- ─────────────────────────────────────────────
CREATE TABLE products (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    sku             VARCHAR(50)     NOT NULL,
    name            VARCHAR(200)    NOT NULL,
    description     TEXT,
    category_id     UUID            REFERENCES product_categories(id) ON DELETE RESTRICT,
    base_uom_id     UUID            NOT NULL REFERENCES units_of_measure(id),
    sale_price      NUMERIC(18, 2)  NOT NULL DEFAULT 0 CHECK (sale_price >= 0),
    purchase_price  NUMERIC(18, 2)  NOT NULL DEFAULT 0 CHECK (purchase_price >= 0),
    min_stock_qty   NUMERIC(15, 4)  NOT NULL DEFAULT 0 CHECK (min_stock_qty >= 0),
    barcode         VARCHAR(100),
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    created_by      UUID            NOT NULL,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_products_sku UNIQUE (sku)
);

COMMENT ON COLUMN products.min_stock_qty IS 'Ngưỡng tồn kho tối thiểu để phát cảnh báo';
COMMENT ON COLUMN products.sale_price IS 'Giá bán mặc định (VND)';

-- ─────────────────────────────────────────────
-- WAREHOUSES
-- ─────────────────────────────────────────────
CREATE TABLE warehouses (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    code        VARCHAR(20) NOT NULL,
    name        VARCHAR(200) NOT NULL,
    address     TEXT,
    manager_id  UUID,       -- FK to users, set after users table created
    is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_warehouses_code UNIQUE (code)
);

-- ─────────────────────────────────────────────
-- STOCK LOCATIONS
-- ─────────────────────────────────────────────
CREATE TABLE stock_locations (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id    UUID        NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    code            VARCHAR(50) NOT NULL,
    name            VARCHAR(200),
    is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_stock_locations_code UNIQUE (warehouse_id, code)
);

COMMENT ON TABLE stock_locations IS 'Vị trí trong kho (kệ, ô, khu vực)';
```

### 4.2 Inventory Tables

```sql
-- ─────────────────────────────────────────────
-- STOCK TRANSACTION TYPES (ENUM)
-- ─────────────────────────────────────────────
CREATE TYPE stock_transaction_type AS ENUM (
    'OPENING_BALANCE',    -- Nhập tồn đầu kỳ
    'INTERNAL_RECEIPT',   -- Nhập kho nội bộ
    'INTERNAL_ISSUE',     -- Xuất kho nội bộ
    'TRANSFER_OUT',       -- Xuất chuyển kho (nguồn)
    'TRANSFER_IN',        -- Nhập chuyển kho (đích)
    'PURCHASE_RECEIPT',   -- Nhập từ nhà cung cấp (GRN)
    'PURCHASE_RETURN',    -- Trả hàng cho nhà cung cấp
    'SALE_DELIVERY',      -- Xuất giao khách hàng (GDN)
    'SALE_RETURN',        -- Nhận trả hàng từ khách
    'ADJUSTMENT_PLUS',    -- Điều chỉnh tăng (kiểm kê)
    'ADJUSTMENT_MINUS'    -- Điều chỉnh giảm (kiểm kê)
);

-- ─────────────────────────────────────────────
-- INVENTORY (BALANCE TABLE)
-- ─────────────────────────────────────────────
CREATE TABLE inventory (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id      UUID            NOT NULL REFERENCES products(id),
    warehouse_id    UUID            NOT NULL REFERENCES warehouses(id),
    location_id     UUID            REFERENCES stock_locations(id),
    quantity        NUMERIC(15, 4)  NOT NULL DEFAULT 0,
    reserved_qty    NUMERIC(15, 4)  NOT NULL DEFAULT 0 CHECK (reserved_qty >= 0),
    avg_cost        NUMERIC(18, 4)  NOT NULL DEFAULT 0 CHECK (avg_cost >= 0),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_inventory UNIQUE (product_id, warehouse_id, location_id),
    CONSTRAINT chk_inventory_qty CHECK (quantity >= 0 OR quantity < 0)
    -- NOTE: quantity có thể âm nếu cấu hình cho phép (SA-003)
);

COMMENT ON TABLE inventory IS 'Số dư tồn kho hiện tại theo sản phẩm/kho/vị trí';
COMMENT ON COLUMN inventory.reserved_qty IS 'Số lượng đang đặt bán chờ xuất kho';
COMMENT ON COLUMN inventory.avg_cost IS 'Giá vốn bình quân gia quyền di động';

-- VIEW: available quantity
CREATE VIEW v_inventory_available AS
SELECT
    i.*,
    (i.quantity - i.reserved_qty) AS available_qty,
    p.sku,
    p.name AS product_name,
    p.min_stock_qty,
    w.name AS warehouse_name,
    sl.code AS location_code,
    CASE
        WHEN (i.quantity - i.reserved_qty) <= p.min_stock_qty THEN TRUE
        ELSE FALSE
    END AS below_min_stock
FROM inventory i
JOIN products p ON p.id = i.product_id
JOIN warehouses w ON w.id = i.warehouse_id
LEFT JOIN stock_locations sl ON sl.id = i.location_id;

-- ─────────────────────────────────────────────
-- STOCK TRANSACTIONS
-- ─────────────────────────────────────────────
CREATE TABLE stock_transactions (
    id                  UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
    type                stock_transaction_type  NOT NULL,
    ref_type            VARCHAR(50),            -- 'StockReceipt', 'GoodsReceiptNote', ...
    ref_id              UUID,                   -- ID của chứng từ liên quan
    ref_number          VARCHAR(50),            -- Số chứng từ liên quan
    product_id          UUID                    NOT NULL REFERENCES products(id),
    warehouse_id        UUID                    NOT NULL REFERENCES warehouses(id),
    location_id         UUID                    REFERENCES stock_locations(id),
    quantity            NUMERIC(15, 4)          NOT NULL,  -- dương=nhập, âm=xuất
    uom_id              UUID                    NOT NULL REFERENCES units_of_measure(id),
    base_qty            NUMERIC(15, 4)          NOT NULL,  -- quy về UoM cơ sở
    unit_cost           NUMERIC(18, 4)          NOT NULL DEFAULT 0,
    total_cost          NUMERIC(18, 2)          NOT NULL DEFAULT 0,
    note                TEXT,
    transaction_date    DATE                    NOT NULL DEFAULT CURRENT_DATE,
    created_by          UUID                    NOT NULL,
    created_at          TIMESTAMPTZ             NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN stock_transactions.quantity IS 'Số lượng theo UoM giao dịch; dương=nhập, âm=xuất';
COMMENT ON COLUMN stock_transactions.base_qty IS 'Số lượng quy đổi về UoM cơ sở của sản phẩm';

-- ─────────────────────────────────────────────
-- STOCK RECEIPTS (Phiếu nhập kho nội bộ)
-- ─────────────────────────────────────────────
CREATE TYPE document_status AS ENUM ('draft', 'confirmed', 'cancelled');

CREATE TABLE stock_receipts (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_number  VARCHAR(30)     NOT NULL,
    warehouse_id    UUID            NOT NULL REFERENCES warehouses(id),
    status          document_status NOT NULL DEFAULT 'draft',
    receipt_date    DATE            NOT NULL DEFAULT CURRENT_DATE,
    reason          VARCHAR(500),
    note            TEXT,
    confirmed_by    UUID,
    confirmed_at    TIMESTAMPTZ,
    created_by      UUID            NOT NULL,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_stock_receipts_number UNIQUE (receipt_number)
);

CREATE TABLE stock_receipt_lines (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_id      UUID            NOT NULL REFERENCES stock_receipts(id) ON DELETE CASCADE,
    product_id      UUID            NOT NULL REFERENCES products(id),
    location_id     UUID            REFERENCES stock_locations(id),
    quantity        NUMERIC(15, 4)  NOT NULL CHECK (quantity > 0),
    uom_id          UUID            NOT NULL REFERENCES units_of_measure(id),
    unit_cost       NUMERIC(18, 4)  NOT NULL DEFAULT 0,
    line_total      NUMERIC(18, 2)  GENERATED ALWAYS AS (quantity * unit_cost) STORED,
    note            TEXT
);

-- ─────────────────────────────────────────────
-- STOCK ISSUES (Phiếu xuất kho nội bộ)
-- ─────────────────────────────────────────────
CREATE TABLE stock_issues (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_number    VARCHAR(30)     NOT NULL,
    warehouse_id    UUID            NOT NULL REFERENCES warehouses(id),
    status          document_status NOT NULL DEFAULT 'draft',
    issue_date      DATE            NOT NULL DEFAULT CURRENT_DATE,
    reason          VARCHAR(500),
    note            TEXT,
    confirmed_by    UUID,
    confirmed_at    TIMESTAMPTZ,
    created_by      UUID            NOT NULL,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_stock_issues_number UNIQUE (issue_number)
);

CREATE TABLE stock_issue_lines (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_id        UUID            NOT NULL REFERENCES stock_issues(id) ON DELETE CASCADE,
    product_id      UUID            NOT NULL REFERENCES products(id),
    location_id     UUID            REFERENCES stock_locations(id),
    quantity        NUMERIC(15, 4)  NOT NULL CHECK (quantity > 0),
    uom_id          UUID            NOT NULL REFERENCES units_of_measure(id),
    unit_cost       NUMERIC(18, 4)  NOT NULL DEFAULT 0,
    note            TEXT
);

-- ─────────────────────────────────────────────
-- STOCK TRANSFERS (Phiếu chuyển kho)
-- ─────────────────────────────────────────────
CREATE TABLE stock_transfers (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_number     VARCHAR(30)     NOT NULL,
    from_warehouse_id   UUID            NOT NULL REFERENCES warehouses(id),
    from_location_id    UUID            REFERENCES stock_locations(id),
    to_warehouse_id     UUID            NOT NULL REFERENCES warehouses(id),
    to_location_id      UUID            REFERENCES stock_locations(id),
    status              document_status NOT NULL DEFAULT 'draft',
    transfer_date       DATE            NOT NULL DEFAULT CURRENT_DATE,
    note                TEXT,
    confirmed_by        UUID,
    confirmed_at        TIMESTAMPTZ,
    created_by          UUID            NOT NULL,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_stock_transfers_number UNIQUE (transfer_number),
    CONSTRAINT chk_transfer_warehouses CHECK (
        from_warehouse_id <> to_warehouse_id
        OR from_location_id IS DISTINCT FROM to_location_id
    )
);

CREATE TABLE stock_transfer_lines (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_id     UUID            NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
    product_id      UUID            NOT NULL REFERENCES products(id),
    quantity        NUMERIC(15, 4)  NOT NULL CHECK (quantity > 0),
    uom_id          UUID            NOT NULL REFERENCES units_of_measure(id)
);

-- ─────────────────────────────────────────────
-- STOCK TAKING (Kiểm kê kho)
-- ─────────────────────────────────────────────
CREATE TYPE stock_taking_status AS ENUM ('in_progress', 'completed', 'cancelled');

CREATE TABLE stock_taking_sessions (
    id              UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id    UUID                NOT NULL REFERENCES warehouses(id),
    status          stock_taking_status NOT NULL DEFAULT 'in_progress',
    note            TEXT,
    started_at      TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ,
    created_by      UUID                NOT NULL,
    approved_by     UUID,
    approved_at     TIMESTAMPTZ
);

CREATE TABLE stock_taking_lines (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID            NOT NULL REFERENCES stock_taking_sessions(id) ON DELETE CASCADE,
    product_id      UUID            NOT NULL REFERENCES products(id),
    location_id     UUID            REFERENCES stock_locations(id),
    system_qty      NUMERIC(15, 4)  NOT NULL DEFAULT 0,
    counted_qty     NUMERIC(15, 4),
    difference      NUMERIC(15, 4)  GENERATED ALWAYS AS (counted_qty - system_qty) STORED,
    note            TEXT
);
```

### 4.3 Purchase Tables

```sql
-- ─────────────────────────────────────────────
-- SUPPLIERS
-- ─────────────────────────────────────────────
CREATE TABLE suppliers (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    code                VARCHAR(20) NOT NULL,
    name                VARCHAR(200) NOT NULL,
    tax_code            VARCHAR(20),
    address             TEXT,
    phone               VARCHAR(20),
    email               VARCHAR(200),
    contact_person      VARCHAR(200),
    payment_term_days   INTEGER     NOT NULL DEFAULT 30 CHECK (payment_term_days >= 0),
    is_active           BOOLEAN     NOT NULL DEFAULT TRUE,
    note                TEXT,
    created_by          UUID        NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_suppliers_code UNIQUE (code)
);

-- ─────────────────────────────────────────────
-- PURCHASE ORDERS
-- ─────────────────────────────────────────────
CREATE TYPE po_status AS ENUM (
    'draft',
    'pending_approval',
    'confirmed',
    'partially_received',
    'fully_received',
    'cancelled'
);

CREATE TABLE purchase_orders (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    po_number           VARCHAR(30)     NOT NULL,
    supplier_id         UUID            NOT NULL REFERENCES suppliers(id),
    warehouse_id        UUID            NOT NULL REFERENCES warehouses(id),
    status              po_status       NOT NULL DEFAULT 'draft',
    order_date          DATE            NOT NULL DEFAULT CURRENT_DATE,
    expected_date       DATE,
    subtotal            NUMERIC(18, 2)  NOT NULL DEFAULT 0,
    tax_amount          NUMERIC(18, 2)  NOT NULL DEFAULT 0,
    grand_total         NUMERIC(18, 2)  NOT NULL DEFAULT 0,
    note                TEXT,
    approved_by         UUID,
    approved_at         TIMESTAMPTZ,
    created_by          UUID            NOT NULL,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_purchase_orders_number UNIQUE (po_number)
);

CREATE TABLE purchase_order_lines (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id           UUID            NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    product_id      UUID            NOT NULL REFERENCES products(id),
    qty_ordered     NUMERIC(15, 4)  NOT NULL CHECK (qty_ordered > 0),
    qty_received    NUMERIC(15, 4)  NOT NULL DEFAULT 0,
    uom_id          UUID            NOT NULL REFERENCES units_of_measure(id),
    unit_price      NUMERIC(18, 4)  NOT NULL CHECK (unit_price >= 0),
    tax_rate        NUMERIC(5, 2)   NOT NULL DEFAULT 0 CHECK (tax_rate BETWEEN 0 AND 100),
    subtotal        NUMERIC(18, 2)  GENERATED ALWAYS AS (qty_ordered * unit_price) STORED,
    tax_amount      NUMERIC(18, 2)  GENERATED ALWAYS AS (
                        ROUND(qty_ordered * unit_price * tax_rate / 100, 2)
                    ) STORED,
    note            TEXT
);

-- ─────────────────────────────────────────────
-- GOODS RECEIPT NOTES (GRN — Phiếu nhập hàng từ NCC)
-- ─────────────────────────────────────────────
CREATE TABLE goods_receipt_notes (
    id                      UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    grn_number              VARCHAR(30)     NOT NULL,
    po_id                   UUID            REFERENCES purchase_orders(id),
    supplier_id             UUID            NOT NULL REFERENCES suppliers(id),
    warehouse_id            UUID            NOT NULL REFERENCES warehouses(id),
    status                  document_status NOT NULL DEFAULT 'draft',
    receipt_date            DATE            NOT NULL DEFAULT CURRENT_DATE,
    supplier_invoice_no     VARCHAR(100),
    supplier_invoice_date   DATE,
    subtotal                NUMERIC(18, 2)  NOT NULL DEFAULT 0,
    tax_amount              NUMERIC(18, 2)  NOT NULL DEFAULT 0,
    grand_total             NUMERIC(18, 2)  NOT NULL DEFAULT 0,
    note                    TEXT,
    confirmed_by            UUID,
    confirmed_at            TIMESTAMPTZ,
    created_by              UUID            NOT NULL,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_grn_number UNIQUE (grn_number)
);

CREATE TABLE goods_receipt_lines (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    grn_id          UUID            NOT NULL REFERENCES goods_receipt_notes(id) ON DELETE CASCADE,
    po_line_id      UUID            REFERENCES purchase_order_lines(id),
    product_id      UUID            NOT NULL REFERENCES products(id),
    location_id     UUID            REFERENCES stock_locations(id),
    qty_received    NUMERIC(15, 4)  NOT NULL CHECK (qty_received > 0),
    uom_id          UUID            NOT NULL REFERENCES units_of_measure(id),
    unit_price      NUMERIC(18, 4)  NOT NULL CHECK (unit_price >= 0),
    tax_rate        NUMERIC(5, 2)   NOT NULL DEFAULT 0,
    subtotal        NUMERIC(18, 2)  GENERATED ALWAYS AS (qty_received * unit_price) STORED,
    tax_amount      NUMERIC(18, 2)  GENERATED ALWAYS AS (
                        ROUND(qty_received * unit_price * tax_rate / 100, 2)
                    ) STORED
);

-- ─────────────────────────────────────────────
-- ACCOUNTS PAYABLE (Công nợ phải trả)
-- ─────────────────────────────────────────────
CREATE TYPE payment_status AS ENUM ('unpaid', 'partially_paid', 'paid');

CREATE TABLE accounts_payable (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    grn_id          UUID            NOT NULL REFERENCES goods_receipt_notes(id),
    supplier_id     UUID            NOT NULL REFERENCES suppliers(id),
    amount_total    NUMERIC(18, 2)  NOT NULL CHECK (amount_total > 0),
    amount_paid     NUMERIC(18, 2)  NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
    amount_remaining NUMERIC(18, 2) GENERATED ALWAYS AS (amount_total - amount_paid) STORED,
    due_date        DATE            NOT NULL,
    status          payment_status  NOT NULL DEFAULT 'unpaid',
    note            TEXT,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE TABLE ap_payments (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    ap_id           UUID            NOT NULL REFERENCES accounts_payable(id),
    payment_date    DATE            NOT NULL DEFAULT CURRENT_DATE,
    amount          NUMERIC(18, 2)  NOT NULL CHECK (amount > 0),
    payment_method  VARCHAR(50)     NOT NULL DEFAULT 'bank_transfer',
    reference_no    VARCHAR(100),
    note            TEXT,
    created_by      UUID            NOT NULL,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);
```

### 4.4 Sales Tables

```sql
-- ─────────────────────────────────────────────
-- CUSTOMERS
-- ─────────────────────────────────────────────
CREATE TABLE customers (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    code                VARCHAR(20)     NOT NULL,
    name                VARCHAR(200)    NOT NULL,
    tax_code            VARCHAR(20),
    billing_address     TEXT,
    shipping_address    TEXT,
    phone               VARCHAR(20),
    email               VARCHAR(200),
    contact_person      VARCHAR(200),
    credit_limit        NUMERIC(18, 2)  NOT NULL DEFAULT 0 CHECK (credit_limit >= 0),
    payment_term_days   INTEGER         NOT NULL DEFAULT 30 CHECK (payment_term_days >= 0),
    customer_group      VARCHAR(50),
    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
    note                TEXT,
    created_by          UUID            NOT NULL,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_customers_code UNIQUE (code)
);

-- ─────────────────────────────────────────────
-- QUOTATIONS (Báo giá)
-- ─────────────────────────────────────────────
CREATE TYPE quotation_status AS ENUM ('draft', 'sent', 'won', 'lost', 'cancelled');

CREATE TABLE quotations (
    id              UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_number    VARCHAR(30)         NOT NULL,
    customer_id     UUID                NOT NULL REFERENCES customers(id),
    status          quotation_status    NOT NULL DEFAULT 'draft',
    quote_date      DATE                NOT NULL DEFAULT CURRENT_DATE,
    valid_until     DATE,
    subtotal        NUMERIC(18, 2)      NOT NULL DEFAULT 0,
    discount_amount NUMERIC(18, 2)      NOT NULL DEFAULT 0,
    tax_amount      NUMERIC(18, 2)      NOT NULL DEFAULT 0,
    grand_total     NUMERIC(18, 2)      NOT NULL DEFAULT 0,
    note            TEXT,
    terms           TEXT,
    created_by      UUID                NOT NULL,
    created_at      TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_quotations_number UNIQUE (quote_number)
);

CREATE TABLE quotation_lines (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id    UUID            NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    product_id      UUID            NOT NULL REFERENCES products(id),
    quantity        NUMERIC(15, 4)  NOT NULL CHECK (quantity > 0),
    uom_id          UUID            NOT NULL REFERENCES units_of_measure(id),
    unit_price      NUMERIC(18, 4)  NOT NULL CHECK (unit_price >= 0),
    discount_pct    NUMERIC(5, 2)   NOT NULL DEFAULT 0 CHECK (discount_pct BETWEEN 0 AND 100),
    tax_rate        NUMERIC(5, 2)   NOT NULL DEFAULT 0 CHECK (tax_rate BETWEEN 0 AND 100),
    subtotal        NUMERIC(18, 2)  GENERATED ALWAYS AS (
                        ROUND(quantity * unit_price * (1 - discount_pct / 100), 2)
                    ) STORED
);

-- ─────────────────────────────────────────────
-- SALES ORDERS
-- ─────────────────────────────────────────────
CREATE TYPE so_status AS ENUM (
    'draft',
    'confirmed',
    'partially_delivered',
    'fully_delivered',
    'cancelled'
);

CREATE TABLE sales_orders (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    so_number       VARCHAR(30) NOT NULL,
    quotation_id    UUID        REFERENCES quotations(id),
    customer_id     UUID        NOT NULL REFERENCES customers(id),
    warehouse_id    UUID        NOT NULL REFERENCES warehouses(id),
    status          so_status   NOT NULL DEFAULT 'draft',
    order_date      DATE        NOT NULL DEFAULT CURRENT_DATE,
    delivery_date   DATE,
    subtotal        NUMERIC(18, 2) NOT NULL DEFAULT 0,
    discount_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
    tax_amount      NUMERIC(18, 2) NOT NULL DEFAULT 0,
    grand_total     NUMERIC(18, 2) NOT NULL DEFAULT 0,
    note            TEXT,
    salesperson_id  UUID,
    created_by      UUID        NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_sales_orders_number UNIQUE (so_number)
);

CREATE TABLE sales_order_lines (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    so_id           UUID            NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
    product_id      UUID            NOT NULL REFERENCES products(id),
    qty_ordered     NUMERIC(15, 4)  NOT NULL CHECK (qty_ordered > 0),
    qty_delivered   NUMERIC(15, 4)  NOT NULL DEFAULT 0,
    uom_id          UUID            NOT NULL REFERENCES units_of_measure(id),
    unit_price      NUMERIC(18, 4)  NOT NULL CHECK (unit_price >= 0),
    discount_pct    NUMERIC(5, 2)   NOT NULL DEFAULT 0 CHECK (discount_pct BETWEEN 0 AND 100),
    tax_rate        NUMERIC(5, 2)   NOT NULL DEFAULT 0 CHECK (tax_rate BETWEEN 0 AND 100),
    subtotal        NUMERIC(18, 2)  GENERATED ALWAYS AS (
                        ROUND(qty_ordered * unit_price * (1 - discount_pct / 100), 2)
                    ) STORED
);

-- ─────────────────────────────────────────────
-- GOODS DELIVERY NOTES (GDN — Phiếu xuất kho giao khách)
-- ─────────────────────────────────────────────
CREATE TABLE goods_delivery_notes (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    gdn_number      VARCHAR(30)     NOT NULL,
    so_id           UUID            REFERENCES sales_orders(id),
    customer_id     UUID            NOT NULL REFERENCES customers(id),
    warehouse_id    UUID            NOT NULL REFERENCES warehouses(id),
    status          document_status NOT NULL DEFAULT 'draft',
    delivery_date   DATE            NOT NULL DEFAULT CURRENT_DATE,
    note            TEXT,
    confirmed_by    UUID,
    confirmed_at    TIMESTAMPTZ,
    created_by      UUID            NOT NULL,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_gdn_number UNIQUE (gdn_number)
);

CREATE TABLE goods_delivery_lines (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    gdn_id          UUID            NOT NULL REFERENCES goods_delivery_notes(id) ON DELETE CASCADE,
    so_line_id      UUID            REFERENCES sales_order_lines(id),
    product_id      UUID            NOT NULL REFERENCES products(id),
    location_id     UUID            REFERENCES stock_locations(id),
    qty_delivered   NUMERIC(15, 4)  NOT NULL CHECK (qty_delivered > 0),
    uom_id          UUID            NOT NULL REFERENCES units_of_measure(id),
    unit_cost       NUMERIC(18, 4)  NOT NULL DEFAULT 0
);

-- ─────────────────────────────────────────────
-- INVOICES (Hóa đơn bán hàng)
-- ─────────────────────────────────────────────
CREATE TYPE invoice_status AS ENUM ('draft', 'confirmed', 'partially_paid', 'paid', 'cancelled');

CREATE TABLE invoices (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number  VARCHAR(30)     NOT NULL,
    so_id           UUID            REFERENCES sales_orders(id),
    customer_id     UUID            NOT NULL REFERENCES customers(id),
    status          invoice_status  NOT NULL DEFAULT 'draft',
    invoice_date    DATE            NOT NULL DEFAULT CURRENT_DATE,
    due_date        DATE            NOT NULL,
    subtotal        NUMERIC(18, 2)  NOT NULL DEFAULT 0,
    discount_amount NUMERIC(18, 2)  NOT NULL DEFAULT 0,
    tax_amount      NUMERIC(18, 2)  NOT NULL DEFAULT 0,
    grand_total     NUMERIC(18, 2)  NOT NULL DEFAULT 0,
    note            TEXT,
    created_by      UUID            NOT NULL,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_invoice_number UNIQUE (invoice_number)
);

CREATE TABLE invoice_lines (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id      UUID            NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    product_id      UUID            NOT NULL REFERENCES products(id),
    quantity        NUMERIC(15, 4)  NOT NULL CHECK (quantity > 0),
    uom_id          UUID            NOT NULL REFERENCES units_of_measure(id),
    unit_price      NUMERIC(18, 4)  NOT NULL CHECK (unit_price >= 0),
    discount_pct    NUMERIC(5, 2)   NOT NULL DEFAULT 0,
    tax_rate        NUMERIC(5, 2)   NOT NULL DEFAULT 0,
    subtotal        NUMERIC(18, 2)  GENERATED ALWAYS AS (
                        ROUND(quantity * unit_price * (1 - discount_pct / 100), 2)
                    ) STORED
);

-- ─────────────────────────────────────────────
-- ACCOUNTS RECEIVABLE (Công nợ phải thu)
-- ─────────────────────────────────────────────
CREATE TABLE accounts_receivable (
    id               UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id       UUID           NOT NULL REFERENCES invoices(id),
    customer_id      UUID           NOT NULL REFERENCES customers(id),
    amount_total     NUMERIC(18, 2) NOT NULL CHECK (amount_total > 0),
    amount_paid      NUMERIC(18, 2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
    amount_remaining NUMERIC(18, 2) GENERATED ALWAYS AS (amount_total - amount_paid) STORED,
    due_date         DATE           NOT NULL,
    status           payment_status NOT NULL DEFAULT 'unpaid',
    note             TEXT,
    created_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE TABLE ar_payments (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    ar_id           UUID            NOT NULL REFERENCES accounts_receivable(id),
    payment_date    DATE            NOT NULL DEFAULT CURRENT_DATE,
    amount          NUMERIC(18, 2)  NOT NULL CHECK (amount > 0),
    payment_method  VARCHAR(50)     NOT NULL DEFAULT 'bank_transfer',
    reference_no    VARCHAR(100),
    note            TEXT,
    created_by      UUID            NOT NULL,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);
```

### 4.5 Admin Tables

```sql
-- ─────────────────────────────────────────────
-- USERS
-- ─────────────────────────────────────────────
CREATE TABLE users (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name       VARCHAR(200) NOT NULL,
    email           VARCHAR(200) NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    phone           VARCHAR(20),
    is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_users_email UNIQUE (email)
);

-- ─────────────────────────────────────────────
-- REFRESH TOKENS
-- ─────────────────────────────────────────────
CREATE TABLE refresh_tokens (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  VARCHAR(255) NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    revoked_at  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_refresh_tokens UNIQUE (token_hash)
);

-- ─────────────────────────────────────────────
-- ROLES & PERMISSIONS
-- ─────────────────────────────────────────────
CREATE TABLE roles (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100) NOT NULL,
    description TEXT,
    is_system   BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_roles_name UNIQUE (name)
);

CREATE TABLE permissions (
    id      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    code    VARCHAR(100) NOT NULL,
    name    VARCHAR(200) NOT NULL,
    module  VARCHAR(50)  NOT NULL,
    CONSTRAINT uq_permissions_code UNIQUE (code)
);

CREATE TABLE role_permissions (
    role_id         UUID    NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id   UUID    NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE user_roles (
    user_id     UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id     UUID    NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

-- ─────────────────────────────────────────────
-- SYSTEM CONFIG
-- ─────────────────────────────────────────────
CREATE TABLE system_configs (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    key         VARCHAR(100) NOT NULL,
    value       TEXT        NOT NULL,
    description TEXT,
    updated_by  UUID,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_system_configs_key UNIQUE (key)
);

-- Seed data mặc định
INSERT INTO system_configs (key, value, description) VALUES
    ('company_name', 'Tên Doanh Nghiệp', 'Tên công ty hiển thị trên chứng từ'),
    ('company_address', '', 'Địa chỉ công ty'),
    ('company_tax_code', '', 'Mã số thuế'),
    ('default_vat_rate', '10', 'Thuế VAT mặc định (%)'),
    ('currency', 'VND', 'Tiền tệ mặc định'),
    ('allow_negative_stock', 'false', 'Cho phép tồn kho âm'),
    ('require_po_approval', 'true', 'Yêu cầu phê duyệt PO'),
    ('prefix_stock_receipt', 'NK', 'Prefix số phiếu nhập kho nội bộ'),
    ('prefix_stock_issue', 'XK', 'Prefix số phiếu xuất kho nội bộ'),
    ('prefix_stock_transfer', 'CK', 'Prefix số phiếu chuyển kho'),
    ('prefix_purchase_order', 'PO', 'Prefix số đơn mua hàng'),
    ('prefix_goods_receipt', 'GRN', 'Prefix số phiếu nhập hàng NCC'),
    ('prefix_sales_order', 'DH', 'Prefix số đơn bán hàng'),
    ('prefix_invoice', 'HD', 'Prefix số hóa đơn'),
    ('timezone', 'Asia/Ho_Chi_Minh', 'Múi giờ hiển thị');

-- ─────────────────────────────────────────────
-- AUDIT LOGS
-- ─────────────────────────────────────────────
CREATE TYPE audit_action AS ENUM (
    'CREATE', 'UPDATE', 'DELETE', 'CONFIRM', 'CANCEL',
    'APPROVE', 'REJECT', 'LOGIN', 'LOGOUT', 'EXPORT'
);

CREATE TABLE audit_logs (
    id          UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID            REFERENCES users(id) ON DELETE SET NULL,
    user_email  VARCHAR(200),   -- snapshot tại thời điểm ghi log
    action      audit_action    NOT NULL,
    module      VARCHAR(50)     NOT NULL,
    entity_type VARCHAR(100)    NOT NULL,
    entity_id   UUID,
    old_values  JSONB,
    new_values  JSONB,
    ip_address  INET,
    user_agent  TEXT,
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- Thêm FK cho warehouses.manager_id (sau khi tạo bảng users)
ALTER TABLE warehouses
    ADD CONSTRAINT fk_warehouses_manager
    FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL;
```

---

## 5. Indexes

```sql
-- ─────────────────────────────────────────────
-- MASTER DATA
-- ─────────────────────────────────────────────
CREATE INDEX idx_products_category ON products (category_id);
CREATE INDEX idx_products_sku ON products (sku);
CREATE INDEX idx_products_barcode ON products (barcode) WHERE barcode IS NOT NULL;
CREATE INDEX idx_products_active ON products (is_active);
CREATE INDEX idx_stock_locations_warehouse ON stock_locations (warehouse_id);
CREATE INDEX idx_product_categories_parent ON product_categories (parent_id);

-- ─────────────────────────────────────────────
-- INVENTORY
-- ─────────────────────────────────────────────
CREATE INDEX idx_inventory_product ON inventory (product_id);
CREATE INDEX idx_inventory_warehouse ON inventory (warehouse_id);
CREATE INDEX idx_inventory_product_warehouse ON inventory (product_id, warehouse_id);

CREATE INDEX idx_stock_txn_product ON stock_transactions (product_id);
CREATE INDEX idx_stock_txn_warehouse ON stock_transactions (warehouse_id);
CREATE INDEX idx_stock_txn_date ON stock_transactions (transaction_date);
CREATE INDEX idx_stock_txn_ref ON stock_transactions (ref_type, ref_id);
CREATE INDEX idx_stock_txn_type ON stock_transactions (type);

CREATE INDEX idx_stock_receipts_status ON stock_receipts (status);
CREATE INDEX idx_stock_receipts_date ON stock_receipts (receipt_date);
CREATE INDEX idx_stock_receipt_lines_receipt ON stock_receipt_lines (receipt_id);
CREATE INDEX idx_stock_receipt_lines_product ON stock_receipt_lines (product_id);

-- ─────────────────────────────────────────────
-- PURCHASE
-- ─────────────────────────────────────────────
CREATE INDEX idx_po_supplier ON purchase_orders (supplier_id);
CREATE INDEX idx_po_status ON purchase_orders (status);
CREATE INDEX idx_po_date ON purchase_orders (order_date);
CREATE INDEX idx_po_lines_po ON purchase_order_lines (po_id);
CREATE INDEX idx_po_lines_product ON purchase_order_lines (product_id);

CREATE INDEX idx_grn_po ON goods_receipt_notes (po_id);
CREATE INDEX idx_grn_supplier ON goods_receipt_notes (supplier_id);
CREATE INDEX idx_grn_status ON goods_receipt_notes (status);
CREATE INDEX idx_grn_date ON goods_receipt_notes (receipt_date);
CREATE INDEX idx_grn_lines_grn ON goods_receipt_lines (grn_id);

CREATE INDEX idx_ap_supplier ON accounts_payable (supplier_id);
CREATE INDEX idx_ap_status ON accounts_payable (status);
CREATE INDEX idx_ap_due_date ON accounts_payable (due_date);

-- ─────────────────────────────────────────────
-- SALES
-- ─────────────────────────────────────────────
CREATE INDEX idx_so_customer ON sales_orders (customer_id);
CREATE INDEX idx_so_status ON sales_orders (status);
CREATE INDEX idx_so_date ON sales_orders (order_date);
CREATE INDEX idx_so_lines_so ON sales_order_lines (so_id);
CREATE INDEX idx_so_lines_product ON sales_order_lines (product_id);

CREATE INDEX idx_invoices_customer ON invoices (customer_id);
CREATE INDEX idx_invoices_status ON invoices (status);
CREATE INDEX idx_invoices_date ON invoices (invoice_date);
CREATE INDEX idx_invoices_due ON invoices (due_date);

CREATE INDEX idx_ar_customer ON accounts_receivable (customer_id);
CREATE INDEX idx_ar_status ON accounts_receivable (status);
CREATE INDEX idx_ar_due_date ON accounts_receivable (due_date);

-- ─────────────────────────────────────────────
-- ADMIN
-- ─────────────────────────────────────────────
CREATE INDEX idx_audit_logs_user ON audit_logs (user_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs (entity_type, entity_id);
CREATE INDEX idx_audit_logs_action ON audit_logs (action);
CREATE INDEX idx_audit_logs_created ON audit_logs (created_at DESC);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens (user_id);
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens (expires_at);
```

---

## 6. Enumerations

| Enum Type | Values |
|-----------|--------|
| `stock_transaction_type` | OPENING_BALANCE, INTERNAL_RECEIPT, INTERNAL_ISSUE, TRANSFER_OUT, TRANSFER_IN, PURCHASE_RECEIPT, PURCHASE_RETURN, SALE_DELIVERY, SALE_RETURN, ADJUSTMENT_PLUS, ADJUSTMENT_MINUS |
| `document_status` | draft, confirmed, cancelled |
| `po_status` | draft, pending_approval, confirmed, partially_received, fully_received, cancelled |
| `so_status` | draft, confirmed, partially_delivered, fully_delivered, cancelled |
| `quotation_status` | draft, sent, won, lost, cancelled |
| `invoice_status` | draft, confirmed, partially_paid, paid, cancelled |
| `payment_status` | unpaid, partially_paid, paid |
| `stock_taking_status` | in_progress, completed, cancelled |
| `audit_action` | CREATE, UPDATE, DELETE, CONFIRM, CANCEL, APPROVE, REJECT, LOGIN, LOGOUT, EXPORT |

---

## 7. Prisma Schema

Prisma schema tương ứng với DDL trên — lưu tại `src/prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Product {
  id             String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  sku            String    @unique @db.VarChar(50)
  name           String    @db.VarChar(200)
  description    String?
  categoryId     String?   @map("category_id") @db.Uuid
  baseUomId      String    @map("base_uom_id") @db.Uuid
  salePrice      Decimal   @default(0) @map("sale_price") @db.Decimal(18, 2)
  purchasePrice  Decimal   @default(0) @map("purchase_price") @db.Decimal(18, 2)
  minStockQty    Decimal   @default(0) @map("min_stock_qty") @db.Decimal(15, 4)
  barcode        String?   @db.VarChar(100)
  isActive       Boolean   @default(true) @map("is_active")
  createdBy      String    @map("created_by") @db.Uuid
  createdAt      DateTime  @default(now()) @map("created_at")
  updatedAt      DateTime  @updatedAt @map("updated_at")

  category       ProductCategory?   @relation(fields: [categoryId], references: [id])
  baseUom        UnitOfMeasure      @relation(fields: [baseUomId], references: [id])
  inventory      Inventory[]
  stockTransactions StockTransaction[]

  @@map("products")
}

// ... (các model còn lại theo cùng pattern)
```

---

## 8. Migration Strategy

**Công cụ:** Prisma Migrate

```bash
# Tạo migration mới (development)
npx prisma migrate dev --name init_schema

# Áp dụng migration lên production
npx prisma migrate deploy

# Reset database (chỉ dùng development)
npx prisma migrate reset

# Xem trạng thái migration
npx prisma migrate status
```

**Quy tắc migration:**
1. Mỗi thay đổi schema tạo một migration file mới, không sửa file cũ.
2. Migration file được commit vào git cùng với code thay đổi tương ứng.
3. Migration phải là **non-destructive** khi deploy lên production có dữ liệu.
4. Thêm cột nullable hoặc có default value — không thêm cột NOT NULL không có default vào bảng đang có dữ liệu.
5. Đổi tên cột: tạo cột mới → migrate data → xóa cột cũ (3 migration riêng biệt).

**Migration naming convention:**
```
YYYYMMDDHHMMSS_<mô_tả_ngắn>.sql
Ví dụ: 20260623000001_init_schema.sql
        20260701000001_add_customer_group.sql
```
