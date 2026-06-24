# API Design Document
# Tài liệu Thiết kế REST API — WSMS v1.0

**Document ID:** WSMS-API-v1.0  
**Version:** 1.0  
**Date:** 2026-06-23  
**Base URL:** `https://wsms.example.com/api/v1`  
**Liên quan:** [SRS.md](../SRS.md) | [ARCHITECTURE.md](./ARCHITECTURE.md)

---

## Table of Contents

1. [Tổng quan](#1-tổng-quan)
2. [Authentication](#2-authentication)
3. [Request & Response Conventions](#3-request--response-conventions)
4. [Error Codes](#4-error-codes)
5. [Endpoints — Auth](#5-endpoints---auth)
6. [Endpoints — Master Data](#6-endpoints---master-data)
7. [Endpoints — Warehouse Management](#7-endpoints---warehouse-management)
8. [Endpoints — Purchase Management](#8-endpoints---purchase-management)
9. [Endpoints — Sales Management](#9-endpoints---sales-management)
10. [Endpoints — Reports](#10-endpoints---reports)
11. [Endpoints — Admin](#11-endpoints---admin)

---

## 1. Tổng quan

### 1.1 Quy ước chung

| Thông số | Giá trị |
|----------|---------|
| Protocol | HTTPS only |
| Format | JSON (`Content-Type: application/json`) |
| Encoding | UTF-8 |
| Versioning | URL path: `/api/v1/...` |
| ID Format | UUID v4 |
| Date Format | ISO 8601: `YYYY-MM-DD` cho date, `YYYY-MM-DDTHH:mm:ssZ` cho datetime |
| Số tiền | String số thập phân `"1500000.00"` (tránh floating-point) |
| Số lượng | String số thập phân `"12.5000"` |
| Phân trang | Query params: `?page=1&limit=20` |
| Sắp xếp | Query params: `?sortBy=created_at&sortOrder=desc` |

### 1.2 Request ID

Mỗi request được gán một ID duy nhất (UUID) trong response header:
```
X-Request-Id: req_a1b2c3d4e5f6
```

---

## 2. Authentication

### 2.1 Đăng nhập

```
POST /api/v1/auth/login
```

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJSUzI1NiJ9...",
    "expiresIn": 900,
    "user": {
      "id": "uuid",
      "fullName": "Nguyễn Văn A",
      "email": "user@example.com",
      "permissions": ["MD-PRODUCT-READ", "WM-RECEIPT-WRITE", "..."]
    }
  }
}
```

> Refresh Token được set trong `httpOnly` cookie tự động.

### 2.2 Refresh Access Token

```
POST /api/v1/auth/refresh
```

Gửi kèm cookie `refreshToken`. Trả về `accessToken` mới.

### 2.3 Đăng xuất

```
POST /api/v1/auth/logout
```

Revoke refresh token. Trả `204 No Content`.

### 2.4 Sử dụng Access Token

Thêm header vào mọi request sau khi đăng nhập:
```
Authorization: Bearer <accessToken>
```

---

## 3. Request & Response Conventions

### 3.1 Success Response

```json
{
  "success": true,
  "data": { ... },          // Object hoặc Array
  "meta": {                 // Chỉ có khi response là danh sách
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

### 3.2 Error Response

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dữ liệu đầu vào không hợp lệ",
    "details": [
      { "field": "sku", "message": "SKU không được để trống" },
      { "field": "baseUomId", "message": "Đơn vị tính không hợp lệ" }
    ]
  },
  "requestId": "req_a1b2c3"
}
```

### 3.3 Pagination Query Params

| Param | Default | Mô tả |
|-------|---------|-------|
| `page` | `1` | Trang hiện tại (bắt đầu từ 1) |
| `limit` | `20` | Số dòng mỗi trang (max: 100) |
| `sortBy` | `created_at` | Cột sắp xếp |
| `sortOrder` | `desc` | `asc` hoặc `desc` |
| `search` | _(trống)_ | Tìm kiếm text (tên, mã) |

---

## 4. Error Codes

| HTTP | Error Code | Mô tả |
|------|------------|-------|
| 400 | `VALIDATION_ERROR` | Dữ liệu request không hợp lệ |
| 400 | `INVALID_DATE_RANGE` | Khoảng ngày không hợp lệ |
| 401 | `UNAUTHORIZED` | Chưa xác thực hoặc token hết hạn |
| 401 | `TOKEN_EXPIRED` | Access token hết hạn |
| 401 | `REFRESH_TOKEN_INVALID` | Refresh token không hợp lệ hoặc đã revoke |
| 403 | `FORBIDDEN` | Không có quyền thực hiện thao tác |
| 404 | `NOT_FOUND` | Tài nguyên không tồn tại |
| 409 | `DUPLICATE_SKU` | SKU sản phẩm đã tồn tại |
| 409 | `DUPLICATE_CODE` | Mã (kho, khách hàng, NCC) đã tồn tại |
| 422 | `INSUFFICIENT_STOCK` | Tồn kho không đủ để xuất |
| 422 | `INVALID_STATUS_TRANSITION` | Không thể chuyển trạng thái (ví dụ: xác nhận PO đã hủy) |
| 422 | `DOCUMENT_ALREADY_CONFIRMED` | Chứng từ đã xác nhận, không thể sửa |
| 422 | `CREDIT_LIMIT_EXCEEDED` | Vượt hạn mức công nợ khách hàng |
| 429 | `RATE_LIMIT_EXCEEDED` | Gửi request quá nhiều |
| 500 | `INTERNAL_ERROR` | Lỗi server nội bộ |

---

## 5. Endpoints — Auth

| Method | Path | Mô tả | Permission |
|--------|------|-------|------------|
| POST | `/auth/login` | Đăng nhập | Public |
| POST | `/auth/logout` | Đăng xuất | Authenticated |
| POST | `/auth/refresh` | Refresh access token | Authenticated (cookie) |
| GET | `/auth/me` | Thông tin user hiện tại | Authenticated |
| PUT | `/auth/change-password` | Đổi mật khẩu | Authenticated |

---

## 6. Endpoints — Master Data

### 6.1 Products

| Method | Path | Mô tả | Permission |
|--------|------|-------|------------|
| GET | `/products` | Danh sách sản phẩm | `MD-PRODUCT-READ` |
| POST | `/products` | Tạo sản phẩm mới | `MD-PRODUCT-WRITE` |
| GET | `/products/:id` | Chi tiết sản phẩm | `MD-PRODUCT-READ` |
| PUT | `/products/:id` | Cập nhật sản phẩm | `MD-PRODUCT-WRITE` |
| PATCH | `/products/:id/deactivate` | Vô hiệu hóa | `MD-PRODUCT-WRITE` |
| PATCH | `/products/:id/activate` | Kích hoạt lại | `MD-PRODUCT-WRITE` |

**GET /products — Query Params:**
- `search` — tìm theo tên, SKU, barcode
- `categoryId` — lọc theo nhóm sản phẩm
- `isActive` — `true` / `false`
- `belowMinStock` — `true` để lọc hàng dưới mức tối thiểu

**POST /products — Request Body:**
```json
{
  "sku": "SP001",
  "name": "Nước ngọt Pepsi 330ml",
  "categoryId": "uuid-category",
  "baseUomId": "uuid-uom-lon",
  "salePrice": "15000.00",
  "purchasePrice": "12000.00",
  "minStockQty": "100.0000",
  "barcode": "8934868032226",
  "description": "Nước ngọt có ga"
}
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "sku": "SP001",
    "name": "Nước ngọt Pepsi 330ml",
    "category": { "id": "uuid", "name": "Đồ uống" },
    "baseUom": { "id": "uuid", "name": "Lon", "symbol": "lon" },
    "salePrice": "15000.00",
    "purchasePrice": "12000.00",
    "minStockQty": "100.0000",
    "barcode": "8934868032226",
    "isActive": true,
    "createdAt": "2026-06-23T08:00:00Z"
  }
}
```

### 6.2 Product Categories

| Method | Path | Mô tả | Permission |
|--------|------|-------|------------|
| GET | `/product-categories` | Cây danh mục | `MD-PRODUCT-READ` |
| POST | `/product-categories` | Tạo nhóm | `MD-PRODUCT-WRITE` |
| PUT | `/product-categories/:id` | Cập nhật nhóm | `MD-PRODUCT-WRITE` |
| PATCH | `/product-categories/:id/deactivate` | Vô hiệu hóa | `MD-PRODUCT-WRITE` |

### 6.3 Units of Measure

| Method | Path | Mô tả | Permission |
|--------|------|-------|------------|
| GET | `/uom` | Danh sách đơn vị tính | `MD-PRODUCT-READ` |
| POST | `/uom` | Tạo đơn vị tính | `SA-CONFIG-WRITE` |
| PUT | `/uom/:id` | Cập nhật | `SA-CONFIG-WRITE` |
| GET | `/uom/:id/conversions` | Xem quy đổi | `MD-PRODUCT-READ` |
| POST | `/uom/:id/conversions` | Thêm quy đổi | `SA-CONFIG-WRITE` |

### 6.4 Warehouses

| Method | Path | Mô tả | Permission |
|--------|------|-------|------------|
| GET | `/warehouses` | Danh sách kho | `MD-WAREHOUSE-READ` |
| POST | `/warehouses` | Tạo kho | `MD-WAREHOUSE-WRITE` |
| GET | `/warehouses/:id` | Chi tiết kho | `MD-WAREHOUSE-READ` |
| PUT | `/warehouses/:id` | Cập nhật kho | `MD-WAREHOUSE-WRITE` |
| GET | `/warehouses/:id/locations` | Vị trí trong kho | `MD-WAREHOUSE-READ` |
| POST | `/warehouses/:id/locations` | Thêm vị trí | `MD-WAREHOUSE-WRITE` |

---

## 7. Endpoints — Warehouse Management

### 7.1 Inventory

| Method | Path | Mô tả | Permission |
|--------|------|-------|------------|
| GET | `/inventory` | Tồn kho hiện tại | `WM-INVENTORY-READ` |
| GET | `/inventory/summary` | Tóm tắt theo kho | `WM-INVENTORY-READ` |
| GET | `/inventory/low-stock` | Hàng dưới mức tối thiểu | `WM-INVENTORY-READ` |

**GET /inventory — Query Params:**
- `warehouseId`, `locationId`, `productId`, `categoryId`
- `belowMinStock=true`
- `page`, `limit`, `sortBy`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "productId": "uuid",
      "sku": "SP001",
      "productName": "Nước ngọt Pepsi 330ml",
      "warehouseId": "uuid",
      "warehouseName": "Kho Chính",
      "locationCode": "A1-01",
      "quantity": "500.0000",
      "reservedQty": "50.0000",
      "availableQty": "450.0000",
      "avgCost": "12000.0000",
      "stockValue": "6000000.00",
      "minStockQty": "100.0000",
      "belowMinStock": false
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 120, "totalPages": 6 }
}
```

### 7.2 Stock Receipts (Phiếu nhập kho nội bộ)

| Method | Path | Mô tả | Permission |
|--------|------|-------|------------|
| GET | `/stock-receipts` | Danh sách phiếu nhập | `WM-RECEIPT-READ` |
| POST | `/stock-receipts` | Tạo phiếu nhập nháp | `WM-RECEIPT-WRITE` |
| GET | `/stock-receipts/:id` | Chi tiết phiếu nhập | `WM-RECEIPT-READ` |
| PUT | `/stock-receipts/:id` | Sửa phiếu nháp | `WM-RECEIPT-WRITE` |
| POST | `/stock-receipts/:id/confirm` | Xác nhận phiếu | `WM-RECEIPT-APPROVE` |
| POST | `/stock-receipts/:id/cancel` | Hủy phiếu nháp | `WM-RECEIPT-WRITE` |

**POST /stock-receipts — Request Body:**
```json
{
  "warehouseId": "uuid",
  "receiptDate": "2026-06-23",
  "reason": "Nhập tồn đầu kỳ",
  "note": "Ghi chú thêm",
  "lines": [
    {
      "productId": "uuid",
      "locationId": "uuid",
      "quantity": "100.0000",
      "uomId": "uuid",
      "unitCost": "12000.0000",
      "note": ""
    }
  ]
}
```

**POST /stock-receipts/:id/confirm — Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "receiptNumber": "NK-2026-000001",
    "status": "confirmed",
    "confirmedAt": "2026-06-23T09:15:00Z",
    "stockTransactionIds": ["uuid-txn-1", "uuid-txn-2"]
  }
}
```

### 7.3 Stock Issues (Phiếu xuất kho nội bộ)

| Method | Path | Mô tả | Permission |
|--------|------|-------|------------|
| GET | `/stock-issues` | Danh sách phiếu xuất | `WM-ISSUE-READ` |
| POST | `/stock-issues` | Tạo phiếu xuất nháp | `WM-ISSUE-WRITE` |
| GET | `/stock-issues/:id` | Chi tiết | `WM-ISSUE-READ` |
| PUT | `/stock-issues/:id` | Sửa nháp | `WM-ISSUE-WRITE` |
| POST | `/stock-issues/:id/confirm` | Xác nhận | `WM-ISSUE-APPROVE` |
| POST | `/stock-issues/:id/cancel` | Hủy | `WM-ISSUE-WRITE` |

### 7.4 Stock Transfers (Chuyển kho)

| Method | Path | Mô tả | Permission |
|--------|------|-------|------------|
| GET | `/stock-transfers` | Danh sách | `WM-TRANSFER-READ` |
| POST | `/stock-transfers` | Tạo phiếu chuyển | `WM-TRANSFER-WRITE` |
| GET | `/stock-transfers/:id` | Chi tiết | `WM-TRANSFER-READ` |
| PUT | `/stock-transfers/:id` | Sửa nháp | `WM-TRANSFER-WRITE` |
| POST | `/stock-transfers/:id/confirm` | Xác nhận | `WM-TRANSFER-APPROVE` |
| POST | `/stock-transfers/:id/cancel` | Hủy | `WM-TRANSFER-WRITE` |

### 7.5 Stock Taking (Kiểm kê)

| Method | Path | Mô tả | Permission |
|--------|------|-------|------------|
| GET | `/stock-taking` | Danh sách phiên kiểm kê | `WM-STOCKTAKE-READ` |
| POST | `/stock-taking` | Tạo phiên kiểm kê | `WM-STOCKTAKE-WRITE` |
| GET | `/stock-taking/:id` | Chi tiết phiên | `WM-STOCKTAKE-READ` |
| PUT | `/stock-taking/:id/lines` | Nhập số đếm thực tế | `WM-STOCKTAKE-WRITE` |
| POST | `/stock-taking/:id/complete` | Hoàn tất & điều chỉnh kho | `WM-STOCKTAKE-APPROVE` |
| POST | `/stock-taking/:id/cancel` | Hủy phiên | `WM-STOCKTAKE-WRITE` |

---

## 8. Endpoints — Purchase Management

### 8.1 Suppliers

| Method | Path | Mô tả | Permission |
|--------|------|-------|------------|
| GET | `/suppliers` | Danh sách NCC | `PM-SUPPLIER-READ` |
| POST | `/suppliers` | Tạo NCC | `PM-SUPPLIER-WRITE` |
| GET | `/suppliers/:id` | Chi tiết NCC | `PM-SUPPLIER-READ` |
| PUT | `/suppliers/:id` | Cập nhật NCC | `PM-SUPPLIER-WRITE` |
| PATCH | `/suppliers/:id/deactivate` | Vô hiệu hóa | `PM-SUPPLIER-WRITE` |
| GET | `/suppliers/:id/payables` | Công nợ của NCC | `PM-AP-READ` |

### 8.2 Purchase Orders

| Method | Path | Mô tả | Permission |
|--------|------|-------|------------|
| GET | `/purchase-orders` | Danh sách PO | `PM-PO-READ` |
| POST | `/purchase-orders` | Tạo PO | `PM-PO-WRITE` |
| GET | `/purchase-orders/:id` | Chi tiết PO | `PM-PO-READ` |
| PUT | `/purchase-orders/:id` | Sửa PO nháp | `PM-PO-WRITE` |
| POST | `/purchase-orders/:id/submit` | Gửi chờ phê duyệt | `PM-PO-WRITE` |
| POST | `/purchase-orders/:id/approve` | Phê duyệt PO | `PM-PO-APPROVE` |
| POST | `/purchase-orders/:id/reject` | Từ chối PO | `PM-PO-APPROVE` |
| POST | `/purchase-orders/:id/cancel` | Hủy PO | `PM-PO-WRITE` |
| GET | `/purchase-orders/:id/receipts` | GRN liên kết | `PM-PO-READ` |

**POST /purchase-orders — Request Body:**
```json
{
  "supplierId": "uuid",
  "warehouseId": "uuid",
  "orderDate": "2026-06-23",
  "expectedDate": "2026-06-30",
  "note": "",
  "lines": [
    {
      "productId": "uuid",
      "qtyOrdered": "200.0000",
      "uomId": "uuid",
      "unitPrice": "12000.0000",
      "taxRate": "10.00"
    }
  ]
}
```

### 8.3 Goods Receipt Notes (GRN)

| Method | Path | Mô tả | Permission |
|--------|------|-------|------------|
| GET | `/goods-receipts` | Danh sách GRN | `PM-GRN-READ` |
| POST | `/goods-receipts` | Tạo GRN (từ PO hoặc độc lập) | `PM-GRN-WRITE` |
| POST | `/purchase-orders/:id/receipts` | Tạo GRN từ PO | `PM-GRN-WRITE` |
| GET | `/goods-receipts/:id` | Chi tiết GRN | `PM-GRN-READ` |
| PUT | `/goods-receipts/:id` | Sửa GRN nháp | `PM-GRN-WRITE` |
| POST | `/goods-receipts/:id/confirm` | Xác nhận → nhập kho, tạo AP | `PM-GRN-WRITE` |
| POST | `/goods-receipts/:id/cancel` | Hủy | `PM-GRN-WRITE` |

**POST /purchase-orders/:id/receipts — Request Body:**
```json
{
  "receiptDate": "2026-06-28",
  "supplierInvoiceNo": "HD-NCC-001",
  "supplierInvoiceDate": "2026-06-28",
  "note": "",
  "lines": [
    {
      "poLineId": "uuid",
      "productId": "uuid",
      "locationId": "uuid",
      "qtyReceived": "150.0000",
      "uomId": "uuid",
      "unitPrice": "12000.0000",
      "taxRate": "10.00"
    }
  ]
}
```

### 8.4 Accounts Payable

| Method | Path | Mô tả | Permission |
|--------|------|-------|------------|
| GET | `/accounts-payable` | Danh sách công nợ NCC | `PM-AP-READ` |
| GET | `/accounts-payable/:id` | Chi tiết AP | `PM-AP-READ` |
| POST | `/accounts-payable/:id/payments` | Ghi nhận thanh toán | `PM-AP-PAYMENT` |
| GET | `/accounts-payable/:id/payments` | Lịch sử thanh toán | `PM-AP-READ` |

---

## 9. Endpoints — Sales Management

### 9.1 Customers

| Method | Path | Mô tả | Permission |
|--------|------|-------|------------|
| GET | `/customers` | Danh sách khách hàng | `SM-CUSTOMER-READ` |
| POST | `/customers` | Tạo khách hàng | `SM-CUSTOMER-WRITE` |
| GET | `/customers/:id` | Chi tiết KH | `SM-CUSTOMER-READ` |
| PUT | `/customers/:id` | Cập nhật KH | `SM-CUSTOMER-WRITE` |
| PATCH | `/customers/:id/deactivate` | Vô hiệu hóa | `SM-CUSTOMER-WRITE` |
| GET | `/customers/:id/receivables` | Công nợ của KH | `SM-AR-READ` |
| GET | `/customers/:id/orders` | Đơn hàng của KH | `SM-SO-READ` |

### 9.2 Quotations

| Method | Path | Mô tả | Permission |
|--------|------|-------|------------|
| GET | `/quotations` | Danh sách báo giá | `SM-QUOTE-READ` |
| POST | `/quotations` | Tạo báo giá | `SM-QUOTE-WRITE` |
| GET | `/quotations/:id` | Chi tiết | `SM-QUOTE-READ` |
| PUT | `/quotations/:id` | Sửa nháp | `SM-QUOTE-WRITE` |
| POST | `/quotations/:id/send` | Đánh dấu đã gửi | `SM-QUOTE-WRITE` |
| POST | `/quotations/:id/convert-to-order` | Chuyển thành SO | `SM-SO-WRITE` |
| PATCH | `/quotations/:id/status` | Cập nhật trạng thái (won/lost) | `SM-QUOTE-WRITE` |

### 9.3 Sales Orders

| Method | Path | Mô tả | Permission |
|--------|------|-------|------------|
| GET | `/sales-orders` | Danh sách SO | `SM-SO-READ` |
| POST | `/sales-orders` | Tạo SO | `SM-SO-WRITE` |
| GET | `/sales-orders/:id` | Chi tiết SO | `SM-SO-READ` |
| PUT | `/sales-orders/:id` | Sửa SO nháp | `SM-SO-WRITE` |
| POST | `/sales-orders/:id/confirm` | Xác nhận SO | `SM-SO-WRITE` |
| POST | `/sales-orders/:id/cancel` | Hủy SO | `SM-SO-WRITE` |
| GET | `/sales-orders/:id/deliveries` | GDN liên kết | `SM-SO-READ` |
| GET | `/sales-orders/:id/invoices` | Hóa đơn liên kết | `SM-SO-READ` |

**POST /sales-orders — Request Body:**
```json
{
  "customerId": "uuid",
  "warehouseId": "uuid",
  "quotationId": null,
  "orderDate": "2026-06-23",
  "deliveryDate": "2026-06-25",
  "note": "",
  "lines": [
    {
      "productId": "uuid",
      "qtyOrdered": "50.0000",
      "uomId": "uuid",
      "unitPrice": "15000.0000",
      "discountPct": "5.00",
      "taxRate": "10.00"
    }
  ]
}
```

### 9.4 Goods Delivery Notes (GDN)

| Method | Path | Mô tả | Permission |
|--------|------|-------|------------|
| GET | `/goods-deliveries` | Danh sách GDN | `SM-GDN-READ` |
| POST | `/sales-orders/:id/deliveries` | Tạo GDN từ SO | `SM-GDN-WRITE` |
| GET | `/goods-deliveries/:id` | Chi tiết GDN | `SM-GDN-READ` |
| POST | `/goods-deliveries/:id/confirm` | Xác nhận → xuất kho | `SM-GDN-WRITE` |
| POST | `/goods-deliveries/:id/cancel` | Hủy GDN | `SM-GDN-WRITE` |

### 9.5 Invoices

| Method | Path | Mô tả | Permission |
|--------|------|-------|------------|
| GET | `/invoices` | Danh sách hóa đơn | `SM-INV-READ` |
| POST | `/sales-orders/:id/invoices` | Tạo hóa đơn từ SO | `SM-INV-WRITE` |
| GET | `/invoices/:id` | Chi tiết hóa đơn | `SM-INV-READ` |
| POST | `/invoices/:id/confirm` | Xác nhận hóa đơn → tạo AR | `SM-INV-WRITE` |
| POST | `/invoices/:id/cancel` | Hủy hóa đơn | `SM-INV-WRITE` |
| GET | `/invoices/:id/pdf` | Xuất PDF hóa đơn | `SM-INV-READ` |

### 9.6 Accounts Receivable

| Method | Path | Mô tả | Permission |
|--------|------|-------|------------|
| GET | `/accounts-receivable` | Danh sách công nợ KH | `SM-AR-READ` |
| GET | `/accounts-receivable/:id` | Chi tiết AR | `SM-AR-READ` |
| POST | `/accounts-receivable/:id/payments` | Ghi nhận thanh toán | `SM-AR-PAYMENT` |
| GET | `/accounts-receivable/:id/payments` | Lịch sử thanh toán | `SM-AR-READ` |

---

## 10. Endpoints — Reports

Tất cả report endpoint hỗ trợ query param `format=json` (mặc định) hoặc `format=excel` hoặc `format=pdf`.

| Method | Path | Mô tả | Permission |
|--------|------|-------|------------|
| GET | `/reports/inventory-summary` | Tồn kho tổng hợp | `RP-ALL-READ` |
| GET | `/reports/stock-movement` | Nhập xuất tồn | `RP-ALL-READ` |
| GET | `/reports/sales-revenue` | Doanh thu bán hàng | `RP-ALL-READ` |
| GET | `/reports/purchase-summary` | Mua hàng | `RP-ALL-READ` |
| GET | `/reports/receivables-aging` | Công nợ phải thu theo tuổi | `RP-ALL-READ` |
| GET | `/reports/payables-aging` | Công nợ phải trả theo tuổi | `RP-ALL-READ` |
| GET | `/reports/dashboard` | Dashboard KPIs | `RP-DASHBOARD-READ` |

**GET /reports/stock-movement — Query Params:**

| Param | Bắt buộc | Mô tả |
|-------|----------|-------|
| `fromDate` | Có | YYYY-MM-DD |
| `toDate` | Có | YYYY-MM-DD |
| `warehouseId` | Không | Lọc theo kho |
| `productId` | Không | Lọc theo sản phẩm |
| `categoryId` | Không | Lọc theo nhóm |
| `transactionType` | Không | Lọc theo loại giao dịch |
| `format` | Không | `json` / `excel` / `pdf` |

**GET /reports/dashboard — Response:**
```json
{
  "success": true,
  "data": {
    "totalStockValue": "85000000.00",
    "pendingSalesOrders": 12,
    "pendingPOApprovals": 3,
    "totalARUnpaid": "25000000.00",
    "totalAPUnpaid": "18000000.00",
    "lowStockProducts": 5,
    "salesThisMonth": "120000000.00",
    "salesLastMonth": "98000000.00",
    "salesGrowthPct": "22.45",
    "topProducts": [
      { "productId": "uuid", "name": "Pepsi 330ml", "qtySold": "1200.0000", "revenue": "18000000.00" }
    ],
    "recentTransactions": [
      { "type": "SALE_DELIVERY", "refNumber": "GH-2026-000023", "date": "2026-06-23", "amount": "2500000.00" }
    ]
  }
}
```

**GET /reports/receivables-aging — Response:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "notDue": "15000000.00",
      "days1to30": "8000000.00",
      "days31to60": "1500000.00",
      "days61to90": "500000.00",
      "over90": "0.00",
      "total": "25000000.00"
    },
    "details": [
      {
        "customerId": "uuid",
        "customerName": "Công ty ABC",
        "invoiceNumber": "HD-2026-000045",
        "invoiceDate": "2026-05-20",
        "dueDate": "2026-06-20",
        "amountTotal": "5000000.00",
        "amountPaid": "2000000.00",
        "amountRemaining": "3000000.00",
        "daysOverdue": 3,
        "agingBucket": "days1to30"
      }
    ]
  },
  "meta": { "page": 1, "limit": 50, "total": 8, "totalPages": 1 }
}
```

---

## 11. Endpoints — Admin

### 11.1 Users

| Method | Path | Mô tả | Permission |
|--------|------|-------|------------|
| GET | `/admin/users` | Danh sách người dùng | `SA-USER-READ` |
| POST | `/admin/users` | Tạo người dùng | `SA-USER-WRITE` |
| GET | `/admin/users/:id` | Chi tiết | `SA-USER-READ` |
| PUT | `/admin/users/:id` | Cập nhật | `SA-USER-WRITE` |
| PATCH | `/admin/users/:id/deactivate` | Vô hiệu hóa | `SA-USER-WRITE` |
| PATCH | `/admin/users/:id/roles` | Cập nhật vai trò | `SA-USER-WRITE` |
| POST | `/admin/users/:id/reset-password` | Reset mật khẩu | `SA-USER-WRITE` |

### 11.2 Roles & Permissions

| Method | Path | Mô tả | Permission |
|--------|------|-------|------------|
| GET | `/admin/roles` | Danh sách vai trò | `SA-ROLE-READ` |
| POST | `/admin/roles` | Tạo vai trò | `SA-ROLE-WRITE` |
| GET | `/admin/roles/:id` | Chi tiết vai trò + permissions | `SA-ROLE-READ` |
| PUT | `/admin/roles/:id/permissions` | Cập nhật permissions của vai trò | `SA-ROLE-WRITE` |
| GET | `/admin/permissions` | Danh sách tất cả permissions | `SA-ROLE-READ` |

### 11.3 System Config

| Method | Path | Mô tả | Permission |
|--------|------|-------|------------|
| GET | `/admin/config` | Xem cấu hình hệ thống | `SA-CONFIG-READ` |
| PUT | `/admin/config` | Cập nhật cấu hình | `SA-CONFIG-WRITE` |

### 11.4 Audit Log

| Method | Path | Mô tả | Permission |
|--------|------|-------|------------|
| GET | `/admin/audit-logs` | Danh sách audit log | `SA-AUDIT-READ` |
| GET | `/admin/audit-logs/:id` | Chi tiết log | `SA-AUDIT-READ` |

**GET /admin/audit-logs — Query Params:**
- `userId`, `action`, `module`, `entityType`, `entityId`
- `fromDate`, `toDate`
- `page`, `limit`
