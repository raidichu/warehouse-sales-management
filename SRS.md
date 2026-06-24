# Software Requirements Specification
# Hệ thống Quản lý Kho hàng & Bán hàng (WSMS)

**Document ID:** WSMS-SRS-v1.0  
**Version:** 1.0  
**Date:** 2026-06-23  
**Status:** Draft

---

## Table of Contents

1. [Introduction](#1-introduction)
   - 1.1 [Purpose](#11-purpose)
   - 1.2 [Scope](#12-scope)
   - 1.3 [Definitions & Acronyms](#13-definitions--acronyms)
   - 1.4 [Document Overview](#14-document-overview)
   - 1.5 [Change Log](#15-change-log)
2. [Overall System Description](#2-overall-system-description)
   - 2.1 [Product Perspective](#21-product-perspective)
   - 2.2 [Product Functions](#22-product-functions)
   - 2.3 [User Classes & Characteristics](#23-user-classes--characteristics)
   - 2.4 [Operating Environment](#24-operating-environment)
   - 2.5 [Design Constraints](#25-design-constraints)
   - 2.6 [Assumptions & Dependencies](#26-assumptions--dependencies)
3. [Functional Requirements](#3-functional-requirements)
   - 3.1 [Master Data Management (MD)](#31-master-data-management-md---quản-lý-danh-mục)
   - 3.2 [Warehouse Management (WM)](#32-warehouse-management-wm---quản-lý-kho-hàng)
   - 3.3 [Purchase Management (PM)](#33-purchase-management-pm---quản-lý-mua-hàng)
   - 3.4 [Sales Management (SM)](#34-sales-management-sm---quản-lý-bán-hàng)
   - 3.5 [Reports & Analytics (RP)](#35-reports--analytics-rp---báo-cáo--thống-kê)
   - 3.6 [System Administration (SA)](#36-system-administration-sa---quản-trị-hệ-thống)
4. [Non-Functional Requirements](#4-non-functional-requirements)
5. [System Interface Requirements](#5-system-interface-requirements)
6. [Data Model Overview](#6-data-model-overview)
7. [Constraints & Compliance](#7-constraints--compliance)

---

## 1. Introduction

### 1.1 Purpose

Tài liệu này là Đặc tả Yêu cầu Phần mềm (Software Requirements Specification — SRS) cho **Hệ thống Quản lý Kho hàng & Bán hàng (Warehouse & Sales Management System — WSMS)**. Mục đích của tài liệu:

- Định nghĩa rõ ràng các yêu cầu chức năng và phi chức năng của hệ thống.
- Làm cơ sở ký kết hợp đồng và thống nhất phạm vi giữa các bên liên quan.
- Cung cấp tài liệu tham chiếu cho đội thiết kế, phát triển, kiểm thử và vận hành.

Tài liệu này tuân theo khung tiêu chuẩn IEEE 830-1998 (được điều chỉnh).

### 1.2 Scope

**Tên hệ thống:** WSMS — Warehouse & Sales Management System  
**Phiên bản mục tiêu:** v1.0

WSMS là ứng dụng web dành cho doanh nghiệp vừa và nhỏ (SME) với quy mô 10–200 nhân viên, vận hành 1–5 kho hàng. Hệ thống bao gồm 6 module chính:

| Module | Tên tiếng Việt |
|--------|----------------|
| Master Data Management (MD) | Quản lý Danh mục |
| Warehouse Management (WM) | Quản lý Kho hàng |
| Purchase Management (PM) | Quản lý Mua hàng |
| Sales Management (SM) | Quản lý Bán hàng |
| Reports & Analytics (RP) | Báo cáo & Thống kê |
| System Administration (SA) | Quản trị Hệ thống |

**Ngoài phạm vi (Out of Scope) — v1.0:**
- Tích hợp phần mềm kế toán bên thứ ba (MISA, Fast Accounting)
- Module sản xuất (Manufacturing / BOM)
- Ứng dụng di động (Mobile App)
- Tích hợp thương mại điện tử (Shopee, Lazada, Tiki)
- Phần mềm hóa đơn điện tử (sẽ xem xét ở v1.1)

### 1.3 Definitions & Acronyms

| Thuật ngữ / Acronym | Định nghĩa |
|---------------------|------------|
| WSMS | Warehouse & Sales Management System — Hệ thống Quản lý Kho hàng & Bán hàng |
| SRS | Software Requirements Specification — Đặc tả Yêu cầu Phần mềm |
| SME | Small & Medium Enterprise — Doanh nghiệp vừa và nhỏ |
| SKU | Stock Keeping Unit — Đơn vị lưu kho (mã sản phẩm duy nhất) |
| UoM | Unit of Measure — Đơn vị tính |
| PO | Purchase Order — Đơn đặt hàng mua |
| GRN | Goods Receipt Note — Phiếu nhập kho từ nhà cung cấp |
| GDN | Goods Delivery Note — Phiếu xuất kho giao khách |
| SO | Sales Order — Đơn bán hàng |
| AR | Accounts Receivable — Công nợ phải thu (từ khách hàng) |
| AP | Accounts Payable — Công nợ phải trả (cho nhà cung cấp) |
| RBAC | Role-Based Access Control — Kiểm soát truy cập theo vai trò |
| JWT | JSON Web Token — Token xác thực API |
| HTTPS | HyperText Transfer Protocol Secure |
| SPA | Single Page Application — Ứng dụng web một trang |
| NFR | Non-Functional Requirement — Yêu cầu phi chức năng |
| UC | Use Case — Trường hợp sử dụng |
| Actor | Người dùng hoặc hệ thống thực hiện UC |
| Tồn kho | Số lượng hàng hóa hiện có trong kho |
| Chứng từ | Tài liệu ghi nhận giao dịch kho/mua/bán (phiếu nhập, xuất, hóa đơn, ...) |

### 1.4 Document Overview

| Chương | Nội dung |
|--------|----------|
| 1 | Giới thiệu, phạm vi, thuật ngữ |
| 2 | Mô tả tổng quan hệ thống, người dùng, môi trường |
| 3 | Yêu cầu chức năng chi tiết theo module (30 use case) |
| 4 | Yêu cầu phi chức năng (Performance, Security, Usability, ...) |
| 5 | Yêu cầu giao diện hệ thống |
| 6 | Mô hình dữ liệu tổng quan (20 entity chính) |
| 7 | Ràng buộc pháp lý, kỹ thuật, nghiệp vụ |

### 1.5 Change Log

| Phiên bản | Ngày | Người soạn | Mô tả thay đổi |
|-----------|------|------------|----------------|
| 1.0 | 2026-06-23 | (Soạn thảo ban đầu) | Phát hành lần đầu |

---

## 2. Overall System Description

### 2.1 Product Perspective

WSMS là hệ thống phần mềm **độc lập** (standalone), không tích hợp với ERP lớn trong phiên bản v1.0. Hệ thống bao gồm:

- **Frontend:** Ứng dụng web SPA chạy trên trình duyệt (Chrome, Firefox, Edge).
- **Backend:** API RESTful phục vụ các thao tác nghiệp vụ và truy vấn dữ liệu.
- **Database:** Cơ sở dữ liệu quan hệ (PostgreSQL khuyến nghị).
- **Authentication:** Xác thực bằng JWT; phân quyền theo mô hình RBAC.

```
┌──────────────────────────────────────────┐
│              Người dùng cuối             │
│  (Admin / Manager / Staff / Accountant)  │
└──────────────┬───────────────────────────┘
               │ HTTPS
┌──────────────▼───────────────────────────┐
│         Web Browser (SPA Frontend)       │
│     React / Vue / Angular (TBD)          │
└──────────────┬───────────────────────────┘
               │ REST API / HTTPS / JSON
┌──────────────▼───────────────────────────┐
│          Backend API Server              │
│     Node.js / Python / Java (TBD)        │
│  ┌────────────────────────────────────┐  │
│  │  Auth │ WM │ PM │ SM │ RP │ SA    │  │
│  └────────────────────────────────────┘  │
└──────────────┬───────────────────────────┘
               │ SQL
┌──────────────▼───────────────────────────┐
│          PostgreSQL Database             │
└──────────────────────────────────────────┘
               │ SMTP
┌──────────────▼───────────────────────────┐
│         Email Server (Notifications)     │
└──────────────────────────────────────────┘
```

### 2.2 Product Functions

Tóm tắt các nhóm chức năng chính của WSMS:

| # | Nhóm chức năng | Chức năng chính |
|---|----------------|-----------------|
| 1 | Quản lý Danh mục | Sản phẩm, đơn vị tính, nhóm sản phẩm, kho & vị trí lưu kho |
| 2 | Quản lý Kho hàng | Nhập/xuất kho nội bộ, chuyển kho, kiểm kê, theo dõi tồn kho, cảnh báo tồn tối thiểu |
| 3 | Quản lý Mua hàng | Quản lý nhà cung cấp, đặt hàng mua, nhận hàng (GRN), trả hàng, công nợ phải trả |
| 4 | Quản lý Bán hàng | Quản lý khách hàng, báo giá, đơn bán hàng, hóa đơn & xuất kho (GDN), trả hàng, công nợ phải thu |
| 5 | Báo cáo & Thống kê | Tồn kho, nhập xuất tồn, doanh thu, mua hàng, công nợ, dashboard tổng quan |
| 6 | Quản trị Hệ thống | Quản lý người dùng, vai trò & phân quyền (RBAC), cấu hình hệ thống, nhật ký hoạt động |

### 2.3 User Classes & Characteristics

| Vai trò | Ký hiệu | Mô tả & Đặc điểm |
|---------|---------|------------------|
| System Administrator | ADMIN | Quản trị viên hệ thống; toàn quyền; quản lý người dùng, vai trò, cấu hình; thường 1–2 người; am hiểu IT |
| Warehouse Manager | WM-MGR | Quản lý kho; phê duyệt phiếu kho, kiểm kê, xem báo cáo tồn kho; am hiểu nghiệp vụ kho |
| Warehouse Staff | WM-STAFF | Nhân viên kho; nhập/xuất kho, kiểm kê; thao tác nhiều, cần giao diện nhanh gọn |
| Sales Staff | SALES | Nhân viên bán hàng; tạo báo giá, đơn bán hàng, hóa đơn, xem công nợ khách hàng |
| Purchase Staff | PURCHASE | Nhân viên mua hàng; tạo PO, nhập hàng, trả hàng, xem công nợ nhà cung cấp |
| Accountant | ACCT | Kế toán; xem & quản lý công nợ AR/AP, báo cáo tài chính, không thao tác kho |

### 2.4 Operating Environment

| Thành phần | Yêu cầu |
|------------|---------|
| Trình duyệt người dùng | Google Chrome ≥ 110, Mozilla Firefox ≥ 110, Microsoft Edge ≥ 110 |
| Độ phân giải tối thiểu | 1280 × 720 px (desktop); hỗ trợ responsive đến 768 px (tablet) |
| Máy chủ ứng dụng | Linux (Ubuntu 22.04 LTS) hoặc Windows Server 2022 |
| Cơ sở dữ liệu | PostgreSQL 15+ (khuyến nghị) |
| Kết nối mạng | Tối thiểu 10 Mbps (băng thông nội bộ LAN hoặc Internet) |
| Giao thức | HTTPS (TLS 1.2+); HTTP không được phép trên môi trường production |

### 2.5 Design Constraints

| ID | Ràng buộc thiết kế |
|----|-------------------|
| DC-01 | Giao diện người dùng phải hỗ trợ đầy đủ tiếng Việt (Unicode UTF-8), bao gồm nhập liệu và hiển thị dữ liệu có dấu |
| DC-02 | Toàn bộ giao tiếp client–server phải qua HTTPS; không cho phép kết nối HTTP thuần trên production |
| DC-03 | Ứng dụng phải là SPA (Single Page Application), không reload toàn trang khi điều hướng giữa các màn hình |
| DC-04 | Phần mềm phải hoạt động mà không cần cài đặt plugin hay extension đặc biệt trên trình duyệt |
| DC-05 | Tất cả tính toán liên quan đến tiền tệ phải dùng kiểu số thập phân chính xác (DECIMAL), không dùng floating-point |
| DC-06 | Dữ liệu tiền tệ mặc định là VND; hệ thống không yêu cầu hỗ trợ đa tiền tệ trong v1.0 |
| DC-07 | Hệ thống phải hỗ trợ xuất dữ liệu báo cáo sang định dạng Excel (.xlsx) và PDF |

### 2.6 Assumptions & Dependencies

**Giả định:**
- Người dùng cuối có khả năng sử dụng trình duyệt web cơ bản và nhập liệu bằng bàn phím tiếng Việt.
- Doanh nghiệp đã có hạ tầng máy chủ (on-premise hoặc cloud VPS) đủ năng lực để triển khai WSMS.
- Mỗi giao dịch kho chỉ liên quan đến một kho (không hỗ trợ giao dịch đa kho đồng thời trong một phiếu, trừ chuyển kho).
- Hệ thống không xử lý lô hàng (batch/lot tracking) trong v1.0, trừ khi được yêu cầu bổ sung.
- Số liệu tồn kho ban đầu (opening balance) sẽ được nhập thủ công vào hệ thống trước khi đi vào vận hành.

**Phụ thuộc bên ngoài:**
- Máy chủ SMTP để gửi email thông báo (tùy chọn, cần cấu hình).
- Thư viện xuất PDF/Excel tích hợp vào backend.
- Máy quét mã vạch (barcode scanner) kết nối qua USB HID — nhập dữ liệu như bàn phím thông thường (tùy chọn).

---

## 3. Functional Requirements

> **Quy ước Use Case:**
> - **ID:** `[MODULE]-[NNN]` (ví dụ: `WM-001`)
> - **Priority:** High / Medium / Low
> - Mỗi use case bao gồm: Mô tả, Actor, Tiền điều kiện, Luồng chính, Luồng thay thế/ngoại lệ, Hậu điều kiện.

---

### 3.1 Master Data Management (MD) — Quản lý Danh mục

---

#### MD-001: Manage Products / Quản lý Sản phẩm

| Thuộc tính | Giá trị |
|------------|---------|
| **ID** | MD-001 |
| **Priority** | High |
| **Actor** | ADMIN, WM-MGR |

**Mô tả:** Cho phép người dùng có quyền tạo mới, xem, chỉnh sửa và vô hiệu hóa (không xóa cứng) thông tin sản phẩm/hàng hóa trong danh mục hệ thống.

**Tiền điều kiện:** Người dùng đã đăng nhập và có quyền `MD-PRODUCT-WRITE`.

**Thông tin sản phẩm bao gồm:**
- Mã sản phẩm (SKU) — duy nhất, tự động sinh hoặc nhập thủ công
- Tên sản phẩm
- Nhóm sản phẩm (danh mục)
- Đơn vị tính mặc định
- Giá mua tham khảo / Giá bán mặc định
- Mô tả / Ghi chú
- Mã vạch (barcode) — tùy chọn
- Trạng thái: Đang hoạt động / Ngừng kinh doanh
- Tồn kho tối thiểu (min stock level) — dùng cho cảnh báo

**Luồng chính — Tạo sản phẩm mới:**
1. Người dùng truy cập menu **Danh mục > Sản phẩm** và chọn **Thêm mới**.
2. Hệ thống hiển thị form nhập liệu sản phẩm.
3. Người dùng điền thông tin bắt buộc: Tên, SKU, Đơn vị tính, Nhóm sản phẩm.
4. Người dùng nhấn **Lưu**.
5. Hệ thống kiểm tra SKU không trùng lặp.
6. Hệ thống lưu sản phẩm mới với trạng thái **Đang hoạt động**.
7. Hệ thống hiển thị thông báo thành công và chuyển về trang danh sách.

**Luồng thay thế:**
- **3a.** SKU đã tồn tại → hệ thống báo lỗi, yêu cầu nhập SKU khác.
- **4a.** Thiếu trường bắt buộc → hệ thống highlight trường lỗi và không cho lưu.

**Luồng chính — Vô hiệu hóa sản phẩm:**
1. Người dùng tìm kiếm sản phẩm cần vô hiệu hóa.
2. Người dùng chọn **Vô hiệu hóa**.
3. Hệ thống kiểm tra sản phẩm không có tồn kho dương và không có giao dịch đang mở.
4. Hệ thống chuyển trạng thái sản phẩm sang **Ngừng kinh doanh**.

**Hậu điều kiện:** Sản phẩm được lưu/cập nhật trong cơ sở dữ liệu. Sản phẩm vô hiệu hóa không xuất hiện trong các dropdown chọn sản phẩm của giao dịch mới.

---

#### MD-002: Manage Units of Measure / Quản lý Đơn vị tính

| Thuộc tính | Giá trị |
|------------|---------|
| **ID** | MD-002 |
| **Priority** | High |
| **Actor** | ADMIN |

**Mô tả:** Quản lý các đơn vị tính (UoM) và tỷ lệ quy đổi giữa chúng (ví dụ: 1 thùng = 24 lon).

**Luồng chính:**
1. Người dùng vào **Danh mục > Đơn vị tính**, chọn **Thêm mới**.
2. Nhập tên đơn vị tính (ví dụ: Cái, Kg, Lít, Thùng, Hộp).
3. Tùy chọn: Định nghĩa quy đổi — chọn đơn vị cơ sở và tỷ lệ (ví dụ: 1 Thùng = 24 Cái).
4. Lưu đơn vị tính.

**Hậu điều kiện:** Đơn vị tính mới có thể được gán cho sản phẩm. Tỷ lệ quy đổi được dùng để tính số lượng theo đơn vị cơ sở trong báo cáo.

---

#### MD-003: Manage Product Categories / Quản lý Nhóm sản phẩm

| Thuộc tính | Giá trị |
|------------|---------|
| **ID** | MD-003 |
| **Priority** | Medium |
| **Actor** | ADMIN, WM-MGR |

**Mô tả:** Quản lý cây danh mục sản phẩm (hỗ trợ cấu trúc phân cấp tối đa 3 cấp, ví dụ: Thực phẩm > Đồ uống > Nước ngọt có ga).

**Luồng chính:**
1. Người dùng vào **Danh mục > Nhóm sản phẩm**.
2. Xem cây danh mục hiện tại.
3. Thêm mới / Sửa tên / Vô hiệu hóa nhóm (nhóm có sản phẩm con không thể vô hiệu hóa).

**Hậu điều kiện:** Nhóm sản phẩm được dùng để lọc sản phẩm trong danh sách và báo cáo.

---

#### MD-004: Manage Warehouses & Locations / Quản lý Kho & Vị trí

| Thuộc tính | Giá trị |
|------------|---------|
| **ID** | MD-004 |
| **Priority** | High |
| **Actor** | ADMIN, WM-MGR |

**Mô tả:** Quản lý thông tin các kho hàng và vị trí lưu trữ (location/bin) bên trong kho.

**Thông tin kho:** Tên kho, mã kho, địa chỉ, người phụ trách, trạng thái.

**Thông tin vị trí:** Mã vị trí (ví dụ: A1-01, A1-02), mô tả, kho chứa, trạng thái.

**Luồng chính:**
1. Người dùng vào **Danh mục > Kho hàng**.
2. Thêm kho mới hoặc chọn kho để thêm vị trí bên trong.
3. Lưu thông tin kho / vị trí.

**Hậu điều kiện:** Kho và vị trí được dùng trong các giao dịch nhập/xuất kho.

---

### 3.2 Warehouse Management (WM) — Quản lý Kho hàng

---

#### WM-001: Goods Receipt (Internal) / Nhập kho nội bộ

| Thuộc tính | Giá trị |
|------------|---------|
| **ID** | WM-001 |
| **Priority** | High |
| **Actor** | WM-STAFF, WM-MGR |

**Mô tả:** Tạo phiếu nhập kho nội bộ (không từ mua hàng) — ví dụ: nhập tồn đầu kỳ, điều chỉnh tăng kho, hàng sản xuất nội bộ.

**Tiền điều kiện:** Người dùng có quyền `WM-RECEIPT-WRITE`. Sản phẩm và kho đã tồn tại trong danh mục.

**Luồng chính:**
1. Người dùng vào **Kho hàng > Phiếu nhập kho**, chọn **Tạo phiếu nhập**.
2. Chọn kho nhập, nhập ngày, lý do nhập kho (tồn đầu kỳ / điều chỉnh / khác).
3. Thêm các dòng hàng: chọn sản phẩm, vị trí lưu kho, số lượng, đơn vị tính, đơn giá (tùy chọn).
4. Nhấn **Lưu nháp** (draft) để lưu tạm.
5. Kiểm tra lại và nhấn **Xác nhận**.
6. Hệ thống sinh số phiếu (NK-YYYY-NNNNNN), cập nhật tồn kho tăng tương ứng, tạo bản ghi `StockTransaction`.
7. Hệ thống ghi `AuditLog`.

**Luồng thay thế:**
- **5a.** Người dùng nhấn **Hủy phiếu nháp** → phiếu chuyển sang trạng thái Đã hủy, tồn kho không thay đổi.
- **6a.** Lỗi giao dịch database → hệ thống rollback, hiển thị lỗi, tồn kho không thay đổi.

**Hậu điều kiện:** Tồn kho tăng đúng số lượng ghi trong phiếu. Phiếu nhập có trạng thái **Đã xác nhận** và không thể chỉnh sửa (chỉ có thể hủy nếu được phép).

---

#### WM-002: Goods Issue (Internal) / Xuất kho nội bộ

| Thuộc tính | Giá trị |
|------------|---------|
| **ID** | WM-002 |
| **Priority** | High |
| **Actor** | WM-STAFF, WM-MGR |

**Mô tả:** Tạo phiếu xuất kho nội bộ — ví dụ: xuất sử dụng nội bộ, xuất hủy hàng, điều chỉnh giảm kho.

**Tiền điều kiện:** Sản phẩm có đủ tồn kho khả dụng tại kho và vị trí được chọn.

**Luồng chính:**
1. Vào **Kho hàng > Phiếu xuất kho**, chọn **Tạo phiếu xuất**.
2. Chọn kho xuất, nhập ngày, lý do xuất kho.
3. Thêm các dòng hàng: sản phẩm, vị trí, số lượng, đơn vị tính.
4. Hệ thống kiểm tra tồn kho khả dụng (available_qty ≥ số lượng xuất).
5. Xác nhận phiếu → hệ thống sinh số phiếu (XK-YYYY-NNNNNN), cập nhật tồn kho giảm, tạo `StockTransaction`.

**Luồng thay thế:**
- **4a.** Tồn kho không đủ → hệ thống hiển thị cảnh báo với số lượng thực tế có thể xuất; không cho phép xác nhận nếu số lượng xuất > tồn kho khả dụng (trừ khi cấu hình cho phép tồn âm có phê duyệt).

**Hậu điều kiện:** Tồn kho giảm đúng số lượng xuất. Phiếu có trạng thái **Đã xác nhận**.

---

#### WM-003: Stock Transfer / Chuyển kho

| Thuộc tính | Giá trị |
|------------|---------|
| **ID** | WM-003 |
| **Priority** | Medium |
| **Actor** | WM-STAFF, WM-MGR |

**Mô tả:** Chuyển hàng hóa từ kho nguồn sang kho đích (hoặc từ vị trí này sang vị trí khác trong cùng kho).

**Tiền điều kiện:** Ít nhất 2 kho hoặc 2 vị trí được thiết lập.

**Luồng chính:**
1. Vào **Kho hàng > Chuyển kho**, chọn **Tạo phiếu chuyển kho**.
2. Chọn kho/vị trí nguồn và kho/vị trí đích.
3. Thêm các dòng hàng và số lượng cần chuyển.
4. Xác nhận → hệ thống đồng thời tạo 2 bản ghi `StockTransaction` trong một database transaction: xuất khỏi nguồn và nhập vào đích.
5. Sinh số phiếu (CK-YYYY-NNNNNN).

**Luồng thay thế:**
- **4a.** Tồn kho nguồn không đủ → báo lỗi, không cho phép xác nhận.
- **4b.** Kho nguồn và kho đích giống nhau, vị trí giống nhau → báo lỗi.

**Hậu điều kiện:** Tồn kho tại nguồn giảm, tại đích tăng tương ứng. Hai giao dịch được thực hiện nguyên tử (atomic).

---

#### WM-004: Stock Taking / Kiểm kê kho

| Thuộc tính | Giá trị |
|------------|---------|
| **ID** | WM-004 |
| **Priority** | High |
| **Actor** | WM-MGR, WM-STAFF |

**Mô tả:** Thực hiện kiểm kê kho định kỳ: xuất danh sách tồn kho hệ thống, nhân viên đếm thực tế, hệ thống tính chênh lệch và điều chỉnh tồn kho.

**Luồng chính:**
1. WM-MGR vào **Kho hàng > Kiểm kê**, chọn **Tạo phiên kiểm kê** cho kho cụ thể.
2. Hệ thống chụp snapshot tồn kho hệ thống tại thời điểm bắt đầu và tạo danh sách kiểm kê.
3. WM-STAFF nhập số lượng thực tế đếm được cho từng dòng sản phẩm.
4. Hệ thống tính chênh lệch: `thực_tế − hệ_thống`.
5. WM-MGR review và phê duyệt điều chỉnh.
6. Hệ thống tạo phiếu điều chỉnh tồn kho (tăng/giảm) tương ứng chênh lệch.
7. Cập nhật tồn kho và đánh dấu phiên kiểm kê **Hoàn thành**.

**Luồng thay thế:**
- **5a.** WM-MGR từ chối → hủy phiên kiểm kê, tồn kho không thay đổi.
- **3a.** Chỉ kiểm kê một phần danh mục → cho phép lọc theo nhóm sản phẩm hoặc vị trí.

**Hậu điều kiện:** Tồn kho trong hệ thống khớp với số liệu thực tế đã kiểm kê. Phiên kiểm kê được lưu trữ đầy đủ để truy vết.

---

#### WM-005: View Stock Levels / Xem tồn kho

| Thuộc tính | Giá trị |
|------------|---------|
| **ID** | WM-005 |
| **Priority** | High |
| **Actor** | WM-MGR, WM-STAFF, SALES, ACCT |

**Mô tả:** Xem tồn kho hiện tại theo sản phẩm, kho, vị trí. Hỗ trợ tìm kiếm, lọc và xuất báo cáo.

**Thông tin hiển thị:**
- Tên sản phẩm, SKU
- Kho, vị trí
- Số lượng tồn kho (hệ thống)
- Số lượng đang đặt hàng bán (reserved)
- Số lượng khả dụng (available = tồn − reserved)
- Tồn kho tối thiểu & trạng thái cảnh báo

**Luồng chính:**
1. Người dùng vào **Kho hàng > Tồn kho**.
2. Hệ thống hiển thị danh sách tồn kho hiện tại.
3. Người dùng có thể lọc theo kho, nhóm sản phẩm, sản phẩm cụ thể.
4. Xuất Excel/PDF nếu cần.

---

#### WM-006: Minimum Stock Alert / Cảnh báo tồn kho tối thiểu

| Thuộc tính | Giá trị |
|------------|---------|
| **ID** | WM-006 |
| **Priority** | Medium |
| **Actor** | Hệ thống (tự động), WM-MGR |

**Mô tả:** Hệ thống tự động phát hiện và hiển thị cảnh báo khi tồn kho của một sản phẩm xuống dưới ngưỡng tối thiểu đã cấu hình.

**Luồng chính:**
1. Sau mỗi giao dịch xuất kho hoặc theo lịch kiểm tra (cron job), hệ thống so sánh tồn kho thực tế với `min_stock_level` của sản phẩm.
2. Nếu `tồn_kho ≤ min_stock_level`, hệ thống tạo cảnh báo trong dashboard.
3. Tùy cấu hình: gửi email thông báo đến WM-MGR.

**Hậu điều kiện:** Cảnh báo xuất hiện trên dashboard và/hoặc email gửi đến người quản lý kho.

---

### 3.3 Purchase Management (PM) — Quản lý Mua hàng

---

#### PM-001: Manage Suppliers / Quản lý Nhà cung cấp

| Thuộc tính | Giá trị |
|------------|---------|
| **ID** | PM-001 |
| **Priority** | High |
| **Actor** | PURCHASE, ADMIN |

**Mô tả:** Quản lý danh bạ nhà cung cấp (thêm, sửa, vô hiệu hóa).

**Thông tin nhà cung cấp:**
- Tên nhà cung cấp, mã nhà cung cấp
- Mã số thuế (MST)
- Địa chỉ, điện thoại, email
- Người liên hệ
- Điều khoản thanh toán mặc định (số ngày credit)
- Trạng thái: Đang hợp tác / Ngừng hợp tác

**Luồng chính:** Tương tự MD-001 với đối tượng Nhà cung cấp.

---

#### PM-002: Create Purchase Order / Tạo đơn đặt hàng mua

| Thuộc tính | Giá trị |
|------------|---------|
| **ID** | PM-002 |
| **Priority** | High |
| **Actor** | PURCHASE |

**Mô tả:** Tạo đơn đặt hàng gửi cho nhà cung cấp.

**Tiền điều kiện:** Nhà cung cấp và sản phẩm đã có trong hệ thống.

**Luồng chính:**
1. Vào **Mua hàng > Đơn đặt hàng**, chọn **Tạo PO**.
2. Chọn nhà cung cấp, kho nhập dự kiến, ngày đặt hàng, ngày giao hàng dự kiến.
3. Thêm các dòng sản phẩm: sản phẩm, số lượng, đơn vị tính, đơn giá, thuế VAT (%).
4. Hệ thống tự tính thành tiền = `số lượng × đơn giá`, tổng tiền, thuế, tổng cộng.
5. Nhập ghi chú / điều khoản.
6. Lưu nháp hoặc chuyển sang trạng thái **Chờ phê duyệt**.
7. Hệ thống sinh số PO (PO-YYYY-NNNNNN).

**Hậu điều kiện:** PO được lưu ở trạng thái **Nháp** hoặc **Chờ phê duyệt**.

---

#### PM-003: Approve Purchase Order / Phê duyệt đơn mua hàng

| Thuộc tính | Giá trị |
|------------|---------|
| **ID** | PM-003 |
| **Priority** | Medium |
| **Actor** | WM-MGR, ADMIN |

**Mô tả:** Người có thẩm quyền phê duyệt hoặc từ chối PO ở trạng thái **Chờ phê duyệt**.

**Tiền điều kiện:** PO ở trạng thái **Chờ phê duyệt**. Người dùng có quyền `PM-PO-APPROVE`.

**Luồng chính:**
1. Người phê duyệt vào **Mua hàng > Đơn đặt hàng**, lọc theo trạng thái **Chờ phê duyệt**.
2. Xem chi tiết PO.
3. Nhấn **Phê duyệt** → PO chuyển sang **Đã xác nhận** (có thể nhập GRN).
4. Hoặc **Từ chối** (kèm lý do) → PO trả về trạng thái **Nháp** để sửa lại.

**Hậu điều kiện:** PO **Đã xác nhận** có thể được dùng để tạo GRN.

---

#### PM-004: Goods Receipt from Supplier / Nhập hàng từ nhà cung cấp (GRN)

| Thuộc tính | Giá trị |
|------------|---------|
| **ID** | PM-004 |
| **Priority** | High |
| **Actor** | WM-STAFF, WM-MGR |

**Mô tả:** Ghi nhận việc nhận hàng thực tế từ nhà cung cấp theo PO đã xác nhận.

**Tiền điều kiện:** PO ở trạng thái **Đã xác nhận**. Hàng hóa đã về kho vật lý.

**Luồng chính:**
1. Vào **Mua hàng > Phiếu nhập hàng (GRN)**, chọn **Tạo GRN** từ PO.
2. Hệ thống tự điền thông tin từ PO; người dùng nhập số lượng thực nhận (có thể nhận từng phần).
3. Chọn kho nhập, vị trí lưu, nhập số hóa đơn nhà cung cấp (nếu có).
4. Xác nhận GRN → hệ thống:
   - Cập nhật tồn kho tăng (tạo `StockTransaction` loại GRN).
   - Tạo bản ghi `AccountsPayable` (AP) với số tiền tương ứng hàng nhận.
   - Cập nhật số lượng đã nhận trên PO.
5. Sinh số GRN (GRN-YYYY-NNNNNN).
6. Nếu đã nhận đủ → PO chuyển sang **Hoàn thành**; nếu còn thiếu → PO ở trạng thái **Nhận một phần**.

**Luồng thay thế:**
- **2a.** Nhận hàng vượt số lượng PO → hệ thống cảnh báo và yêu cầu xác nhận từ WM-MGR.

**Hậu điều kiện:** Tồn kho tăng, AP được tạo cho nhà cung cấp.

---

#### PM-005: Purchase Return / Trả hàng nhà cung cấp

| Thuộc tính | Giá trị |
|------------|---------|
| **ID** | PM-005 |
| **Priority** | Medium |
| **Actor** | WM-STAFF, PURCHASE |

**Mô tả:** Tạo phiếu trả hàng cho nhà cung cấp khi hàng nhận bị lỗi/không đúng quy cách.

**Tiền điều kiện:** GRN liên quan đã xác nhận. Hàng trả còn tồn kho khả dụng.

**Luồng chính:**
1. Vào **Mua hàng > Trả hàng NCC**, chọn GRN cần trả.
2. Chọn sản phẩm và số lượng trả, nhập lý do.
3. Xác nhận → hệ thống xuất kho (tồn giảm), điều chỉnh AP (giảm số tiền phải trả), sinh phiếu trả hàng (PTH-YYYY-NNNNNN).

---

#### PM-006: Manage Payables / Quản lý công nợ nhà cung cấp

| Thuộc tính | Giá trị |
|------------|---------|
| **ID** | PM-006 |
| **Priority** | Medium |
| **Actor** | PURCHASE, ACCT |

**Mô tả:** Xem và ghi nhận thanh toán công nợ cho nhà cung cấp.

**Luồng chính:**
1. Vào **Mua hàng > Công nợ NCC**.
2. Xem danh sách AP theo nhà cung cấp, trạng thái (chưa trả / trả một phần / đã trả), hạn thanh toán.
3. Chọn AP, nhấn **Ghi nhận thanh toán**: nhập ngày thanh toán, số tiền, hình thức thanh toán (tiền mặt / chuyển khoản).
4. Hệ thống cập nhật `amount_paid`, tính `amount_remaining`, chuyển trạng thái AP sang **Đã thanh toán** nếu `amount_remaining = 0`.

---

### 3.4 Sales Management (SM) — Quản lý Bán hàng

---

#### SM-001: Manage Customers / Quản lý Khách hàng

| Thuộc tính | Giá trị |
|------------|---------|
| **ID** | SM-001 |
| **Priority** | High |
| **Actor** | SALES, ADMIN |

**Mô tả:** Quản lý hồ sơ khách hàng.

**Thông tin khách hàng:**
- Tên khách hàng / Tên công ty, mã khách hàng
- Mã số thuế (nếu là doanh nghiệp)
- Địa chỉ giao hàng, địa chỉ xuất hóa đơn
- Điện thoại, email
- Người liên hệ
- Hạn mức công nợ (credit_limit)
- Điều khoản thanh toán (số ngày credit)
- Nhóm khách hàng (phân loại VIP, thông thường, ...)
- Trạng thái: Đang hoạt động / Tạm ngừng

**Luồng chính:** Tương tự MD-001 với đối tượng Khách hàng.

---

#### SM-002: Create Quotation / Tạo Báo giá

| Thuộc tính | Giá trị |
|------------|---------|
| **ID** | SM-002 |
| **Priority** | Medium |
| **Actor** | SALES |

**Mô tả:** Tạo báo giá gửi khách hàng trước khi chốt đơn hàng.

**Luồng chính:**
1. Vào **Bán hàng > Báo giá**, chọn **Tạo báo giá**.
2. Chọn khách hàng, nhập ngày báo giá, ngày hiệu lực.
3. Thêm dòng sản phẩm: sản phẩm, số lượng, đơn giá bán, chiết khấu (%), thuế VAT (%).
4. Hệ thống tính thành tiền, thuế, tổng cộng.
5. Lưu và in/xuất PDF báo giá.
6. Báo giá có thể được **chuyển thành Đơn bán hàng** khi khách hàng chốt.

**Hậu điều kiện:** Báo giá lưu trạng thái **Nháp** / **Đã gửi** / **Thắng** / **Thua**. Không ảnh hưởng tồn kho.

---

#### SM-003: Create Sales Order / Tạo Đơn bán hàng

| Thuộc tính | Giá trị |
|------------|---------|
| **ID** | SM-003 |
| **Priority** | High |
| **Actor** | SALES |

**Mô tả:** Tạo đơn bán hàng (SO) khi khách hàng đặt mua — xác nhận giao dịch, đặt trước tồn kho.

**Tiền điều kiện:** Khách hàng và sản phẩm đã có trong hệ thống.

**Luồng chính:**
1. Vào **Bán hàng > Đơn bán hàng**, chọn **Tạo đơn** (hoặc chuyển từ Báo giá).
2. Chọn khách hàng, ngày đặt hàng, ngày giao dự kiến, kho xuất.
3. Thêm dòng sản phẩm: sản phẩm, số lượng, đơn giá, chiết khấu, thuế.
4. Hệ thống kiểm tra tồn kho khả dụng; hiển thị cảnh báo nếu không đủ (không chặn, chỉ cảnh báo).
5. Kiểm tra hạn mức công nợ khách hàng (AR); cảnh báo nếu vượt `credit_limit`.
6. Xác nhận SO → sinh số SO (DH-YYYY-NNNNNN), đặt trước (reserve) số lượng hàng trong kho.

**Luồng thay thế:**
- **4a.** Tồn kho = 0 → cảnh báo đỏ; SALES vẫn có thể tạo SO (pending fulfillment).
- **5a.** Vượt credit_limit → cảnh báo; yêu cầu phê duyệt từ WM-MGR hoặc ACCT.

**Hậu điều kiện:** SO trạng thái **Đã xác nhận**, tồn kho được đặt trước (reserved), chờ xuất kho & lập hóa đơn.

---

#### SM-004: Create Sales Invoice & Delivery / Xuất kho & Hóa đơn bán hàng

| Thuộc tính | Giá trị |
|------------|---------|
| **ID** | SM-004 |
| **Priority** | High |
| **Actor** | SALES, WM-STAFF |

**Mô tả:** Khi giao hàng cho khách, tạo Phiếu xuất kho (GDN) và Hóa đơn bán hàng liên kết với SO.

**Tiền điều kiện:** SO trạng thái **Đã xác nhận**, có tồn kho khả dụng.

**Luồng chính:**
1. Từ SO đã xác nhận, chọn **Tạo phiếu giao hàng (GDN)**.
2. Xác nhận số lượng xuất (có thể xuất một phần so với SO).
3. Hệ thống tạo GDN: xuất kho (tồn giảm, reserved giải phóng), sinh số GDN (GH-YYYY-NNNNNN).
4. Chọn **Tạo hóa đơn** từ GDN hoặc SO.
5. Hệ thống tạo Invoice với thông tin từ SO/GDN: sản phẩm, số lượng thực xuất, đơn giá, thuế, tổng tiền.
6. Sinh số hóa đơn nội bộ (HD-YYYY-NNNNNN).
7. Tạo bản ghi `AccountsReceivable` (AR) với số tiền hóa đơn và hạn thanh toán.
8. Xuất/in PDF hóa đơn.

**Luồng thay thế:**
- **2a.** Xuất một phần → SO chuyển trạng thái **Giao một phần**; có thể tạo GDN tiếp theo cho phần còn lại.

**Hậu điều kiện:** Tồn kho giảm theo số lượng thực xuất. AR được tạo. Hóa đơn có trạng thái **Chưa thanh toán**.

---

#### SM-005: Sales Return / Trả hàng bán

| Thuộc tính | Giá trị |
|------------|---------|
| **ID** | SM-005 |
| **Priority** | Medium |
| **Actor** | SALES, WM-STAFF |

**Mô tả:** Xử lý khi khách hàng trả lại hàng hóa.

**Tiền điều kiện:** Invoice liên quan đã xác nhận. Hàng trả về kho vật lý.

**Luồng chính:**
1. Vào **Bán hàng > Trả hàng**, chọn Invoice cần trả.
2. Nhập sản phẩm, số lượng trả, lý do, kho nhập lại.
3. Xác nhận → hệ thống nhập kho hàng trả (tồn tăng), điều chỉnh AR (giảm số tiền phải thu), sinh phiếu trả hàng (TH-YYYY-NNNNNN).

---

#### SM-006: Manage Receivables / Quản lý công nợ khách hàng

| Thuộc tính | Giá trị |
|------------|---------|
| **ID** | SM-006 |
| **Priority** | Medium |
| **Actor** | SALES, ACCT |

**Mô tả:** Xem và ghi nhận thanh toán công nợ từ khách hàng.

**Luồng chính:**
1. Vào **Bán hàng > Công nợ khách hàng**.
2. Xem danh sách AR theo khách hàng: số tiền, hạn thanh toán, trạng thái, số ngày quá hạn.
3. Chọn AR, nhấn **Ghi nhận thanh toán**: ngày, số tiền, hình thức.
4. Hệ thống cập nhật `amount_paid`, `amount_remaining`, chuyển AR sang **Đã thanh toán** khi đủ.
5. Tổng AR của khách hàng được cập nhật so sánh với `credit_limit` trong SM-003.

---

### 3.5 Reports & Analytics (RP) — Báo cáo & Thống kê

---

#### RP-001: Inventory Summary Report / Báo cáo tồn kho tổng hợp

| Thuộc tính | Giá trị |
|------------|---------|
| **ID** | RP-001 |
| **Priority** | High |
| **Actor** | WM-MGR, ACCT, ADMIN |

**Mô tả:** Báo cáo tổng hợp số lượng và giá trị tồn kho theo sản phẩm, nhóm sản phẩm, kho.

**Tham số lọc:** Kho, nhóm sản phẩm, sản phẩm, tại ngày (as-of date).

**Cột hiển thị:** SKU, Tên sản phẩm, Nhóm, Kho, Tồn kho, Đơn vị, Giá vốn bình quân, Giá trị tồn kho.

**Xuất:** Excel, PDF.

---

#### RP-002: Stock Movement Report / Báo cáo nhập xuất tồn

| Thuộc tính | Giá trị |
|------------|---------|
| **ID** | RP-002 |
| **Priority** | High |
| **Actor** | WM-MGR, ACCT |

**Mô tả:** Báo cáo chi tiết các phát sinh nhập/xuất kho trong kỳ cho từng sản phẩm.

**Tham số lọc:** Khoảng thời gian (từ ngày — đến ngày), kho, sản phẩm, loại giao dịch.

**Cột hiển thị:** Ngày, Số phiếu, Loại giao dịch, Sản phẩm, Kho, Tồn đầu kỳ, Nhập trong kỳ, Xuất trong kỳ, Tồn cuối kỳ.

---

#### RP-003: Sales Revenue Report / Báo cáo doanh thu bán hàng

| Thuộc tính | Giá trị |
|------------|---------|
| **ID** | RP-003 |
| **Priority** | High |
| **Actor** | SALES, ACCT, ADMIN |

**Mô tả:** Báo cáo doanh thu bán hàng theo kỳ, khách hàng, sản phẩm, nhân viên bán.

**Tham số lọc:** Khoảng thời gian, khách hàng, sản phẩm/nhóm sản phẩm, nhân viên bán.

**Cột hiển thị:** Số hóa đơn, Ngày, Khách hàng, Sản phẩm, Số lượng, Đơn giá, Chiết khấu, Thuế, Thành tiền, Giá vốn, Lợi nhuận gộp.

---

#### RP-004: Purchase Report / Báo cáo mua hàng

| Thuộc tính | Giá trị |
|------------|---------|
| **ID** | RP-004 |
| **Priority** | Medium |
| **Actor** | PURCHASE, ACCT |

**Mô tả:** Báo cáo mua hàng theo kỳ, nhà cung cấp, sản phẩm.

**Tham số lọc:** Khoảng thời gian, nhà cung cấp, sản phẩm.

**Cột hiển thị:** Số GRN, Ngày nhận, Nhà cung cấp, Sản phẩm, Số lượng, Đơn giá, Thành tiền, Thuế, Tổng cộng.

---

#### RP-005: Receivables & Payables Report / Báo cáo công nợ

| Thuộc tính | Giá trị |
|------------|---------|
| **ID** | RP-005 |
| **Priority** | High |
| **Actor** | ACCT, ADMIN |

**Mô tả:** Báo cáo tổng hợp công nợ phải thu (AR) và phải trả (AP) theo đối tượng và tuổi nợ.

**Tham số lọc:** Loại (AR/AP), khách hàng / nhà cung cấp, trạng thái, khoảng thời gian.

**Cột hiển thị:** Đối tượng, Số hóa đơn/GRN, Ngày phát sinh, Hạn thanh toán, Số tiền, Đã thanh toán, Còn lại, Số ngày quá hạn.

**Phân tích tuổi nợ (Aging):** Chưa đến hạn / 1–30 ngày / 31–60 ngày / 61–90 ngày / > 90 ngày.

---

#### RP-006: Executive Dashboard / Dashboard tổng quan

| Thuộc tính | Giá trị |
|------------|---------|
| **ID** | RP-006 |
| **Priority** | High |
| **Actor** | ADMIN, WM-MGR, SALES |

**Mô tả:** Trang tổng quan với các KPI chính, hiển thị ngay sau khi đăng nhập.

**Các widget / KPI:**
- Tổng giá trị tồn kho hiện tại
- Doanh thu tháng này vs. tháng trước (biểu đồ cột)
- Top 5 sản phẩm bán chạy (tháng hiện tại)
- Số đơn hàng đang xử lý / chờ giao
- Số PO đang chờ phê duyệt
- Tổng AR chưa thu / AP chưa trả
- Danh sách sản phẩm dưới mức tồn tối thiểu (cảnh báo đỏ)
- Các giao dịch gần nhất

---

### 3.6 System Administration (SA) — Quản trị Hệ thống

---

#### SA-001: Manage Users / Quản lý Người dùng

| Thuộc tính | Giá trị |
|------------|---------|
| **ID** | SA-001 |
| **Priority** | High |
| **Actor** | ADMIN |

**Mô tả:** Tạo, sửa, vô hiệu hóa tài khoản người dùng; gán vai trò.

**Thông tin người dùng:** Họ tên, email (username), mật khẩu (hash), số điện thoại, vai trò (role), trạng thái, kho được phép thao tác.

**Luồng chính:**
1. ADMIN vào **Quản trị > Người dùng**, chọn **Thêm người dùng**.
2. Điền thông tin và gán vai trò.
3. Hệ thống gửi email chào mừng với link đặt mật khẩu lần đầu (nếu cấu hình SMTP).
4. Người dùng đăng nhập lần đầu, đặt mật khẩu mới.

**Chính sách mật khẩu:** Tối thiểu 8 ký tự, có chữ hoa, chữ thường, số.

---

#### SA-002: Manage Roles & Permissions / Quản lý Vai trò & Phân quyền (RBAC)

| Thuộc tính | Giá trị |
|------------|---------|
| **ID** | SA-002 |
| **Priority** | High |
| **Actor** | ADMIN |

**Mô tả:** Quản lý vai trò (Role) và các quyền (Permission) gán cho vai trò.

**Mô hình RBAC:** User → Role → Permission.

**Vai trò mặc định:**

| Vai trò | Mô tả |
|---------|-------|
| System Administrator | Toàn quyền |
| Warehouse Manager | Xem + phê duyệt tất cả nghiệp vụ kho; xem báo cáo |
| Warehouse Staff | Tạo phiếu nhập/xuất/chuyển kho; không phê duyệt |
| Sales Staff | Quản lý khách hàng, báo giá, đơn bán, hóa đơn; không xóa |
| Purchase Staff | Quản lý NCC, PO, GRN, trả hàng; không phê duyệt PO |
| Accountant | Chỉ xem báo cáo, ghi nhận thanh toán AR/AP |

**Mã quyền (Permission Code) — ví dụ:**

| Permission Code | Mô tả |
|-----------------|-------|
| `MD-PRODUCT-READ` | Xem danh sách sản phẩm |
| `MD-PRODUCT-WRITE` | Tạo/sửa sản phẩm |
| `WM-RECEIPT-WRITE` | Tạo phiếu nhập kho |
| `WM-RECEIPT-APPROVE` | Phê duyệt phiếu nhập kho |
| `PM-PO-WRITE` | Tạo đơn mua hàng |
| `PM-PO-APPROVE` | Phê duyệt đơn mua hàng |
| `PM-GRN-WRITE` | Tạo GRN |
| `SM-SO-WRITE` | Tạo đơn bán hàng |
| `SM-INV-WRITE` | Tạo hóa đơn |
| `SM-AR-PAYMENT` | Ghi nhận thanh toán AR |
| `PM-AP-PAYMENT` | Ghi nhận thanh toán AP |
| `RP-ALL-READ` | Xem toàn bộ báo cáo |
| `SA-USER-WRITE` | Quản lý người dùng |
| `SA-ROLE-WRITE` | Quản lý vai trò & phân quyền |

---

#### SA-003: System Configuration / Cấu hình hệ thống

| Thuộc tính | Giá trị |
|------------|---------|
| **ID** | SA-003 |
| **Priority** | Medium |
| **Actor** | ADMIN |

**Mô tả:** Cấu hình các tham số toàn cục của hệ thống.

**Tham số cấu hình:**
- Tên doanh nghiệp, logo, địa chỉ, MST
- Thuế suất VAT mặc định (%)
- Tiền tệ (VND — mặc định)
- Prefix số chứng từ (NK-, XK-, PO-, DH-, HD-, ...)
- Bật/tắt tính năng phê duyệt PO
- Cho phép tồn kho âm (có/không)
- Cài đặt SMTP email thông báo
- Múi giờ (GMT+7 — mặc định)

---

#### SA-004: Audit Log / Nhật ký hoạt động

| Thuộc tính | Giá trị |
|------------|---------|
| **ID** | SA-004 |
| **Priority** | Medium |
| **Actor** | ADMIN |

**Mô tả:** Xem lịch sử hoạt động của người dùng trên hệ thống.

**Thông tin ghi nhận:**
- Người dùng thực hiện, thời gian
- Hành động (CREATE / UPDATE / DELETE / CONFIRM / CANCEL / LOGIN / LOGOUT)
- Module và loại đối tượng
- ID đối tượng bị tác động
- Giá trị trước và sau thay đổi (JSON)
- IP Address

**Luồng chính:**
1. ADMIN vào **Quản trị > Nhật ký hoạt động**.
2. Lọc theo người dùng, hành động, khoảng thời gian, module.
3. Xem chi tiết từng bản ghi.
4. Xuất Excel nếu cần.

---

## 4. Non-Functional Requirements

### 4.1 Performance

| ID | Yêu cầu | Tiêu chí đo lường |
|----|---------|-------------------|
| NFR-P01 | Thời gian tải trang | Trang load < 2 giây (p95) với kết nối 10 Mbps |
| NFR-P02 | Thời gian phản hồi API | API response < 500ms (p95) cho các thao tác CRUD thông thường |
| NFR-P03 | Thời gian tạo báo cáo | Báo cáo không quá 1 triệu dòng dữ liệu phải hoàn thành < 10 giây |
| NFR-P04 | Concurrent users | Hệ thống phải xử lý ổn định với 50 người dùng đồng thời |
| NFR-P05 | Database query | Query không có full table scan trên bảng > 10.000 dòng; sử dụng index phù hợp |

### 4.2 Security

| ID | Yêu cầu |
|----|---------|
| NFR-S01 | Toàn bộ giao tiếp client–server qua HTTPS/TLS 1.2+ |
| NFR-S02 | Xác thực bằng JWT (Access Token TTL ≤ 15 phút; Refresh Token TTL ≤ 7 ngày) |
| NFR-S03 | Mật khẩu lưu trữ dưới dạng hash (bcrypt, cost factor ≥ 12) |
| NFR-S04 | Phân quyền RBAC được kiểm tra tại tầng API (server-side); không chỉ ẩn/hiện ở UI |
| NFR-S05 | Mọi thao tác quan trọng (tạo/sửa/xóa/xác nhận/hủy chứng từ) phải được ghi vào Audit Log |
| NFR-S06 | Bảo vệ chống OWASP Top 10: SQL Injection, XSS, CSRF, Broken Auth, IDOR, ... |
| NFR-S07 | Rate limiting: tối đa 10 lần thử đăng nhập sai/phút từ 1 IP; sau đó khóa 15 phút |
| NFR-S08 | Session tự động hết hạn sau 8 giờ không hoạt động |
| NFR-S09 | Không log thông tin nhạy cảm (mật khẩu, token) vào server log |

### 4.3 Usability

| ID | Yêu cầu |
|----|---------|
| NFR-U01 | Giao diện phải hoàn toàn bằng tiếng Việt; các thông báo lỗi cũng bằng tiếng Việt |
| NFR-U02 | Responsive design: hoạt động tốt ở độ rộng 1280px (desktop) và 768px (tablet) |
| NFR-U03 | Thao tác thêm dòng vào phiếu nhập/xuất phải hỗ trợ nhập bằng bàn phím (Tab, Enter) |
| NFR-U04 | Mỗi form phải hiển thị rõ trường nào bắt buộc (*) và thông báo lỗi inline |
| NFR-U05 | Mọi thao tác phá hủy (xóa, hủy chứng từ) phải có hộp thoại xác nhận (confirm dialog) |
| NFR-U06 | Hỗ trợ tìm kiếm nhanh (autocomplete) khi chọn sản phẩm/khách hàng/nhà cung cấp |
| NFR-U07 | Giao diện đáp ứng WCAG 2.1 Level AA (contrast ratio, keyboard navigation, ARIA labels) |

### 4.4 Reliability

| ID | Yêu cầu |
|----|---------|
| NFR-R01 | Uptime mục tiêu: 99,5%/tháng (~3,6 giờ downtime/tháng) |
| NFR-R02 | Backup dữ liệu tự động hàng ngày; backup được lưu tối thiểu 30 ngày |
| NFR-R03 | Recovery Time Objective (RTO): < 4 giờ sau sự cố nghiêm trọng |
| NFR-R04 | Recovery Point Objective (RPO): < 24 giờ (tối đa mất 1 ngày dữ liệu) |
| NFR-R05 | Toàn bộ thay đổi tồn kho và tài chính phải thực hiện trong database transaction (ACID) |

### 4.5 Scalability

| ID | Yêu cầu |
|----|---------|
| NFR-SC01 | Hệ thống phải xử lý tốt với 10.000 SKU sản phẩm |
| NFR-SC02 | Hệ thống phải xử lý tốt với 100.000 giao dịch kho/năm |
| NFR-SC03 | Kiến trúc cho phép scale theo chiều ngang (horizontal scaling) khi cần |
| NFR-SC04 | Báo cáo phải hỗ trợ phân trang (pagination); không load toàn bộ dữ liệu vào bộ nhớ |

### 4.6 Maintainability

| ID | Yêu cầu |
|----|---------|
| NFR-M01 | Code coverage của unit test ≥ 80% cho business logic layer |
| NFR-M02 | API phải được tài liệu hóa theo chuẩn OpenAPI 3.0 |
| NFR-M03 | Phân tách rõ ràng giữa các layer: Presentation / Business Logic / Data Access |
| NFR-M04 | Sử dụng biến môi trường (environment variables) cho mọi cấu hình nhạy cảm |
| NFR-M05 | Migration database phải được quản lý bằng công cụ (Flyway / Liquibase / Alembic / ...) |

---

## 5. System Interface Requirements

### 5.1 User Interface Requirements

- Ứng dụng là **Single Page Application (SPA)** chạy trên trình duyệt.
- Thiết kế theo phong cách **dashboard/enterprise UI**: sidebar navigation, header với thông tin người dùng, breadcrumb.
- Màu sắc: nền sáng, màu chủ đạo do đội thiết kế quyết định; phải đảm bảo contrast WCAG 2.1 AA.
- Danh sách dữ liệu phải có: tìm kiếm, lọc, phân trang (10/20/50/100 dòng/trang), sắp xếp theo cột.
- Form nhập liệu phiếu kho/mua/bán phải có bảng dòng hàng (line items) hỗ trợ thêm/xóa/sửa trực tiếp.
- Hỗ trợ **in** và **xuất PDF** cho: phiếu nhập kho, phiếu xuất kho, PO, GRN, hóa đơn bán hàng, báo cáo.
- Hỗ trợ **xuất Excel (.xlsx)** cho toàn bộ báo cáo.
- Thông báo kết quả thao tác (toast/notification): thành công (xanh), lỗi (đỏ), cảnh báo (vàng).

### 5.2 Hardware Interface Requirements

| Thiết bị | Yêu cầu tích hợp |
|----------|------------------|
| Máy quét mã vạch (Barcode Scanner) | Kết nối USB HID — nhập liệu như bàn phím; trường tìm kiếm sản phẩm phải hỗ trợ scan trực tiếp |
| Máy in | In qua trình duyệt (Print CSS) hoặc xuất PDF; không yêu cầu driver đặc biệt |
| Máy in hóa đơn nhiệt (80mm) | Tùy chọn; xuất template in hóa đơn rút gọn cho in nhiệt (cần thiết kế thêm) |

### 5.3 Software Interface Requirements

| Hệ thống | Mô tả tích hợp |
|----------|----------------|
| Email Server (SMTP) | Gửi email thông báo: chào mừng người dùng mới, cảnh báo tồn kho, nhắc công nợ quá hạn. Cấu hình qua SA-003 |
| Phần mềm hóa đơn điện tử | **Ngoài phạm vi v1.0.** Dự kiến tích hợp API hóa đơn điện tử (VNPT, Viettel) ở v1.1 |
| Thư viện xuất PDF | Sử dụng thư viện server-side (ví dụ: WeasyPrint, Puppeteer, iText) để render PDF từ template HTML |
| Thư viện xuất Excel | Sử dụng thư viện (ví dụ: openpyxl, ExcelJS, Apache POI) để xuất .xlsx |

### 5.4 Communication Interface Requirements

| Giao thức | Chi tiết |
|-----------|---------|
| HTTPS REST API | Client–server giao tiếp qua REST API, payload JSON, HTTPS/TLS 1.2+ |
| Authentication | JWT Bearer Token trong header `Authorization: Bearer <token>` |
| Email | SMTP/TLS hoặc SMTP/STARTTLS; cổng 587 (khuyến nghị) hoặc 465 |
| Múi giờ API | Server lưu timestamp ở UTC; client hiển thị theo GMT+7 (Asia/Ho_Chi_Minh) |

---

## 6. Data Model Overview

### 6.1 Entity List

Hệ thống bao gồm **20 entity chính** phân thành các nhóm:

#### Master Data Entities

| Entity | Mô tả | Thuộc tính chính |
|--------|-------|-----------------|
| `ProductCategory` | Nhóm sản phẩm (cây phân cấp) | id, name, parent_id, level, is_active |
| `UnitOfMeasure` | Đơn vị tính | id, name, symbol, is_base |
| `UomConversion` | Quy đổi đơn vị tính | id, from_uom_id, to_uom_id, factor |
| `Product` | Sản phẩm/hàng hóa | id, sku, name, category_id, base_uom_id, sale_price, purchase_price, min_stock_qty, barcode, is_active |
| `Warehouse` | Kho hàng | id, code, name, address, manager_id, is_active |
| `StockLocation` | Vị trí trong kho | id, warehouse_id, code, name, is_active |

#### Inventory Entities

| Entity | Mô tả | Thuộc tính chính |
|--------|-------|-----------------|
| `Inventory` | Số dư tồn kho (balance) theo sản phẩm/kho/vị trí | id, product_id, warehouse_id, location_id, quantity, reserved_qty, avg_cost |
| `StockTransaction` | Giao dịch kho (nhập/xuất) | id, type (IN/OUT), ref_type, ref_id, product_id, warehouse_id, location_id, quantity, uom_id, unit_cost, transaction_date, created_by |
| `StockTakingSession` | Phiên kiểm kê kho | id, warehouse_id, status, started_at, completed_at, created_by |
| `StockTakingLine` | Dòng kiểm kê | id, session_id, product_id, location_id, system_qty, counted_qty, difference |

#### Purchase Entities

| Entity | Mô tả | Thuộc tính chính |
|--------|-------|-----------------|
| `Supplier` | Nhà cung cấp | id, code, name, tax_code, address, phone, email, contact_person, payment_term_days, is_active |
| `PurchaseOrder` | Đơn đặt hàng mua | id, po_number, supplier_id, warehouse_id, status, order_date, expected_date, total_amount, tax_amount, grand_total, approved_by, approved_at |
| `PurchaseOrderLine` | Dòng đơn mua hàng | id, po_id, product_id, qty_ordered, uom_id, unit_price, tax_rate, subtotal |
| `GoodsReceiptNote` | Phiếu nhập kho từ NCC (GRN) | id, grn_number, po_id, supplier_id, warehouse_id, status, receipt_date, supplier_invoice_no |
| `GoodsReceiptLine` | Dòng GRN | id, grn_id, product_id, location_id, qty_received, uom_id, unit_price |
| `AccountsPayable` | Công nợ phải trả | id, grn_id, supplier_id, amount_total, amount_paid, amount_remaining, due_date, status |

#### Sales Entities

| Entity | Mô tả | Thuộc tính chính |
|--------|-------|-----------------|
| `Customer` | Khách hàng | id, code, name, tax_code, billing_address, shipping_address, phone, email, contact_person, credit_limit, payment_term_days, is_active |
| `SalesOrder` | Đơn bán hàng | id, so_number, customer_id, warehouse_id, status, order_date, delivery_date, total_amount, tax_amount, grand_total, salesperson_id |
| `SalesOrderLine` | Dòng đơn bán hàng | id, so_id, product_id, qty_ordered, qty_delivered, uom_id, unit_price, discount_pct, tax_rate, subtotal |
| `GoodsDeliveryNote` | Phiếu xuất kho giao khách (GDN) | id, gdn_number, so_id, customer_id, warehouse_id, status, delivery_date |
| `GoodsDeliveryLine` | Dòng GDN | id, gdn_id, product_id, location_id, qty_delivered, uom_id, unit_price |
| `Invoice` | Hóa đơn bán hàng | id, invoice_number, so_id, customer_id, status, invoice_date, due_date, total_amount, tax_amount, grand_total |
| `InvoiceLine` | Dòng hóa đơn | id, invoice_id, product_id, quantity, uom_id, unit_price, discount_pct, tax_rate, subtotal |
| `AccountsReceivable` | Công nợ phải thu | id, invoice_id, customer_id, amount_total, amount_paid, amount_remaining, due_date, status |

#### Admin Entities

| Entity | Mô tả | Thuộc tính chính |
|--------|-------|-----------------|
| `User` | Người dùng hệ thống | id, full_name, email, password_hash, phone, is_active, last_login_at |
| `Role` | Vai trò | id, name, description, is_system |
| `Permission` | Quyền thao tác | id, code, name, module |
| `RolePermission` | Gán quyền cho vai trò | role_id, permission_id |
| `UserRole` | Gán vai trò cho người dùng | user_id, role_id |
| `SystemConfig` | Cấu hình hệ thống | id, key, value, description |
| `AuditLog` | Nhật ký hoạt động | id, user_id, action, module, entity_type, entity_id, old_values (JSON), new_values (JSON), ip_address, created_at |

### 6.2 Entity Relationship Summary

```
ProductCategory ──< Product >── UnitOfMeasure
Product >──< UomConversion >──< UnitOfMeasure
Product ──< Inventory >── Warehouse ──< StockLocation
Product ──< StockTransaction >── Warehouse
StockTransaction >── StockLocation

Supplier ──< PurchaseOrder ──< PurchaseOrderLine >── Product
PurchaseOrder ──< GoodsReceiptNote ──< GoodsReceiptLine >── Product
GoodsReceiptNote ──> AccountsPayable >── Supplier
GoodsReceiptNote ──> StockTransaction

Customer ──< SalesOrder ──< SalesOrderLine >── Product
SalesOrder ──< GoodsDeliveryNote ──< GoodsDeliveryLine >── Product
GoodsDeliveryNote ──> StockTransaction
SalesOrder ──< Invoice ──< InvoiceLine >── Product
Invoice ──> AccountsReceivable >── Customer

User >──< UserRole >──< Role >──< RolePermission >──< Permission
User ──< AuditLog
```

### 6.3 Key Computed / Derived Values

| Giá trị tính toán | Công thức | Ghi chú |
|-------------------|-----------|---------|
| `Inventory.quantity` | Tổng `StockTransaction.quantity` theo (product, warehouse, location) | Cập nhật khi xác nhận giao dịch |
| `Inventory.available_qty` | `quantity − reserved_qty` | Dùng để kiểm tra trước khi xuất kho |
| `Inventory.avg_cost` | Bình quân gia quyền di động | Cập nhật mỗi khi có giao dịch nhập kho |
| `AccountsReceivable.amount_remaining` | `amount_total − amount_paid` | Cập nhật khi ghi nhận thanh toán |
| `AccountsPayable.amount_remaining` | `amount_total − amount_paid` | Cập nhật khi ghi nhận thanh toán |
| `SalesOrder.qty_delivered` | Tổng từ GDN lines đã xác nhận | Xác định trạng thái SO |

---

## 7. Constraints & Compliance

### 7.1 Legal & Regulatory Constraints

| ID | Ràng buộc | Mô tả |
|----|-----------|-------|
| CON-LEG-01 | Hóa đơn điện tử | Hóa đơn giá trị gia tăng điện tử phải tuân theo **Thông tư 78/2021/TT-BTC** và **Nghị định 123/2020/NĐ-CP**. Trong v1.0, WSMS tạo hóa đơn nội bộ; tích hợp e-invoice bên thứ ba (VNPT, Viettel) sẽ triển khai ở v1.1. |
| CON-LEG-02 | Bảo vệ dữ liệu cá nhân | Thông tin cá nhân khách hàng (họ tên, số điện thoại, địa chỉ) phải được bảo vệ theo **Nghị định 13/2023/NĐ-CP** về Bảo vệ dữ liệu cá nhân. Không chia sẻ hoặc bán dữ liệu cho bên thứ ba. |
| CON-LEG-03 | Lưu trữ chứng từ | Chứng từ kế toán phải lưu trữ tối thiểu **5 năm** (chứng từ thông thường) theo **Luật Kế toán 2015**. Không xóa cứng dữ liệu giao dịch; chỉ hủy (cancelled) có audit trail. |

### 7.2 Technical Constraints

| ID | Ràng buộc | Mô tả |
|----|-----------|-------|
| CON-TECH-01 | Không xóa cứng giao dịch | StockTransaction, Invoice, PurchaseOrder, SalesOrder đã xác nhận không được hard-delete; chỉ hủy (cancelled) kèm reverse entry và audit log |
| CON-TECH-02 | Tính nhất quán tồn kho | Mọi thay đổi tồn kho phải thực hiện trong database transaction; không cập nhật bảng `Inventory` mà không tạo `StockTransaction` tương ứng |
| CON-TECH-03 | Số chứng từ duy nhất | Số chứng từ (NK-, XK-, PO-, DH-, HD-, GRN-, ...) phải duy nhất toàn hệ thống; không tái sử dụng số đã dùng kể cả khi hủy |
| CON-TECH-04 | Kiểu dữ liệu tiền tệ | Toàn bộ tính toán tiền tệ dùng DECIMAL/Numeric; không dùng float/double; làm tròn về đơn vị đồng chỉ ở bước hiển thị/lưu tổng cuối |
| CON-TECH-05 | Không hardcode cấu hình | Thuế suất, tiền tệ, ngưỡng phê duyệt, prefix số chứng từ phải lưu trong `SystemConfig`; không hardcode trong source code |
| CON-TECH-06 | API versioning | Trong vòng đời v1.x, API endpoint đã public không được thay đổi contract theo cách breaking; dùng URL versioning khi cần thay đổi breaking (ví dụ: `/api/v2/...`) |

### 7.3 Business Constraints

| ID | Ràng buộc | Mô tả |
|----|-----------|-------|
| CON-BUS-01 | Tồn kho không âm | Mặc định không cho phép xuất kho khi tồn < 0; có thể cấu hình trong SA-003 cho phép tồn âm với phê duyệt WM-MGR |
| CON-BUS-02 | Liên kết tài chính | Khi hủy GRN đã xác nhận, bản ghi AP liên kết phải được điều chỉnh đồng thời; không để AP không khớp với GRN |
| CON-BUS-03 | Hạn mức công nợ | Khi tổng AR khách hàng vượt `credit_limit`, hệ thống cảnh báo khi tạo SO; không tự động chặn nhưng ghi nhận cảnh báo vào audit log |
| CON-BUS-04 | Đơn vị tính | Mọi giao dịch lưu cả UoM sử dụng và số lượng quy đổi về UoM cơ sở; báo cáo tổng hợp dùng UoM cơ sở |
| CON-BUS-05 | Phê duyệt PO | Khi tính năng phê duyệt PO được bật (SA-003), PO không thể chuyển sang **Đã xác nhận** khi không có bản ghi phê duyệt từ người có quyền `PM-PO-APPROVE` |

### 7.4 Quality Compliance

| ID | Tiêu chuẩn | Áp dụng |
|----|-----------|---------|
| CON-QUA-01 | WCAG 2.1 Level AA | Contrast ratio ≥ 4.5:1, keyboard navigation, ARIA labels cho các thành phần UI chính |
| CON-QUA-02 | OWASP Top 10 | Kiểm tra và không có lỗ hổng OWASP Top 10 trước khi go-live (bao gồm Injection, XSS, IDOR, Broken Auth, ...) |
| CON-QUA-03 | ISO/IEC 25010 | Hệ thống hướng đến đáp ứng: Functional Suitability, Performance Efficiency, Usability, Reliability, Security, Maintainability |

---

*Tài liệu này là **living document** — sẽ được cập nhật theo từng sprint review. Mọi thay đổi yêu cầu phải ghi nhận trong Change Log (Mục 1.5) kèm phiên bản, ngày và người phê duyệt.*

---

**End of Software Requirements Specification — WSMS v1.0**
