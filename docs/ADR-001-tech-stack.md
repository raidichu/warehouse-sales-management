# ADR-001: Technology Stack Decision
# Quyết định Lựa chọn Công nghệ — WSMS v1.0

**ADR ID:** ADR-001  
**Status:** Accepted  
**Date:** 2026-06-23  
**Liên quan:** [ARCHITECTURE.md](./ARCHITECTURE.md) | [SRS.md](../SRS.md)

---

## Context

WSMS là ứng dụng web quản lý kho hàng & bán hàng cho SME Việt Nam. Cần lựa chọn tech stack cân bằng giữa:
- **Năng suất phát triển** — đội nhỏ, thời gian ra sản phẩm ngắn.
- **Khả năng bảo trì** — type safety, tooling tốt, cộng đồng lớn.
- **Phù hợp với SME** — không quá phức tạp về infra, dễ deploy trên VPS đơn.
- **NFR** — Performance, Security, Reliability đã xác định trong SRS Chương 4.

---

## Decisions

### 1. Frontend — React + TypeScript + Vite

**Lựa chọn:** React 18 + TypeScript + Vite

| Tiêu chí | React | Vue 3 | Angular |
|----------|-------|-------|---------|
| Ecosystem / thư viện | Rất phong phú | Tốt | Tốt |
| Type safety | TypeScript tốt | TypeScript tốt | TypeScript tốt |
| Learning curve | Thấp-Trung | Thấp | Cao |
| Cộng đồng VN | Lớn nhất | Lớn | Nhỏ hơn |
| Build tool (Vite) | Hỗ trợ | Hỗ trợ | Không native |

**Lý do chọn React:**
- Ecosystem rộng nhất, đặc biệt cho enterprise UI (shadcn/ui, TanStack).
- TypeScript support hoàn thiện.
- Vite cho build time cực nhanh trong development.
- Cộng đồng developer Việt Nam lớn → dễ tuyển dụng.

**Thư viện bổ sung:**

| Thư viện | Phiên bản | Mục đích |
|----------|-----------|---------|
| `react-router-dom` | v6 | Client-side routing |
| `@tanstack/react-query` | v5 | Server state management, caching, loading states |
| `zustand` | v4 | Client-side global state (auth, UI) |
| `react-hook-form` | v7 | Form state management |
| `zod` | v3 | Schema validation (dùng chung với backend) |
| `axios` | v1 | HTTP client |
| `shadcn/ui` | latest | Component library (Radix UI + Tailwind) |
| `tailwindcss` | v3 | Utility-first CSS |
| `@tanstack/react-table` | v8 | DataTable với sort/filter/pagination |
| `recharts` | v2 | Biểu đồ (dashboard) |
| `date-fns` | v3 | Xử lý ngày tháng |
| `react-to-print` | v2 | In trang / phiếu |

---

### 2. Backend — Node.js + Express + TypeScript

**Lựa chọn:** Node.js 20 LTS + Express 4 + TypeScript

| Tiêu chí | Node.js/Express | Python/FastAPI | Java/Spring |
|----------|----------------|----------------|-------------|
| Shared types với Frontend | Có (TypeScript) | Không | Không |
| Performance | Tốt (I/O bound) | Tốt | Xuất sắc |
| Ecosystem | npm — rất rộng | pip — tốt | Maven — tốt |
| Deploy đơn giản | Node + PM2 | Python + Gunicorn | JRE + Jar |
| Memory footprint | Thấp (~50MB) | Trung (~80MB) | Cao (~200MB+) |

**Lý do chọn Node.js + Express:**
- **Chia sẻ types TypeScript** giữa Frontend và Backend (Zod schemas, types) — giảm lỗi contract API.
- Nhẹ, phù hợp deploy trên VPS nhỏ (1-2 GB RAM).
- Express linh hoạt, không opinionated — dễ cấu trúc theo module.
- PM2 process manager đơn giản cho production.

**Thư viện bổ sung:**

| Thư viện | Phiên bản | Mục đích |
|----------|-----------|---------|
| `express` | v4 | HTTP framework |
| `typescript` | v5 | Type safety |
| `ts-node-dev` | v2 | Hot reload development |
| `zod` | v3 | Request validation schemas |
| `bcryptjs` | v2 | Password hashing |
| `jsonwebtoken` | v9 | JWT sign/verify |
| `cookie-parser` | v1 | Parse httpOnly cookies |
| `helmet` | v7 | Security headers |
| `cors` | v2 | CORS configuration |
| `express-rate-limit` | v7 | Rate limiting |
| `pino` | v8 | Structured JSON logging |
| `pino-http` | v9 | HTTP request logging |
| `nodemailer` | v6 | SMTP email |
| `puppeteer` | v21 | PDF generation (headless Chrome) |
| `exceljs` | v4 | Excel export |
| `uuid` | v9 | UUID generation |
| `date-fns` | v3 | Date utilities |

---

### 3. Database — PostgreSQL 15

**Lựa chọn:** PostgreSQL 15+

| Tiêu chí | PostgreSQL | MySQL 8 | SQLite |
|----------|-----------|---------|--------|
| ACID compliance | Đầy đủ | Đầy đủ | Đầy đủ |
| JSON support (JSONB) | Xuất sắc | Tốt | Hạn chế |
| Generated columns | Có (v12+) | Có (v5.7+) | Có |
| UUID native | Có | Hạn chế | Không |
| Concurrent reads | Xuất sắc (MVCC) | Tốt | Kém |
| Full-text search | Tốt | Tốt | Hạn chế |
| Extensions | Phong phú | Hạn chế | Không |

**Lý do chọn PostgreSQL:**
- **JSONB** cho `audit_logs.old_values/new_values` — query trực tiếp trong JSON.
- **Generated columns** — tự động tính `subtotal`, `amount_remaining` — không lỗi logic.
- **MVCC** — không lock reads, tốt cho báo cáo chạy song song với giao dịch.
- **UUID native** với `gen_random_uuid()` — không cần extension ngoài.
- Cộng đồng mạnh, hỗ trợ lâu dài (open-source).

---

### 4. ORM — Prisma

**Lựa chọn:** Prisma 5

| Tiêu chí | Prisma | TypeORM | Drizzle |
|----------|--------|---------|---------|
| Type safety | Xuất sắc (auto-generate) | Tốt (decorators) | Xuất sắc |
| Schema definition | Declarative .prisma | TypeScript classes | TypeScript |
| Migration | Tự động | Tự động | Semi-manual |
| Learning curve | Thấp | Trung | Thấp |
| Query builder | Tốt | Tốt | SQL-like (linh hoạt) |

**Lý do chọn Prisma:**
- Schema `.prisma` đơn giản, dễ đọc, auto-generate TypeScript types.
- `prisma migrate` tích hợp sẵn, không cần cấu hình phức tạp.
- Prisma Client cực kỳ type-safe — bắt lỗi tại compile time.
- Tài liệu xuất sắc.

**Lưu ý:** Với các query phức tạp (báo cáo, aggregation), dùng `prisma.$queryRaw` để viết SQL tùy chỉnh.

---

### 5. Authentication — JWT + bcrypt

**Lựa chọn:** JWT (RS256) + bcrypt

| Thành phần | Chi tiết |
|------------|---------|
| Access Token | JWT, RS256, TTL 15 phút |
| Refresh Token | UUID opaque token lưu DB, TTL 7 ngày, httpOnly cookie |
| Password Hash | bcrypt, cost factor 12 |
| Token Signing | RSA private key (2048 bit) |

**Lý do không chọn OAuth2/OIDC:** WSMS là hệ thống nội bộ, không cần đăng nhập bằng Google/Facebook. OAuth2 thêm complexity không cần thiết cho v1.0.

**Lý do không dùng session-based auth:**
- API stateless — dễ scale horizontal.
- Phù hợp SPA — không cần server-side session store.

---

### 6. Process Manager — PM2

**Lựa chọn:** PM2 v5

```bash
# ecosystem.config.js
module.exports = {
  apps: [{
    name: 'wsms-api',
    script: 'dist/server.js',
    instances: 2,          // 2 worker processes (cluster mode)
    exec_mode: 'cluster',
    max_memory_restart: '500M',
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000,
    }
  }]
}
```

**Lý do:** PM2 là tiêu chuẩn cho Node.js production. Zero-downtime reload, tự restart khi crash, log rotation built-in.

---

### 7. Web Server — Nginx

**Lựa chọn:** Nginx 1.24+

**Nhiệm vụ:**
- Serve React SPA static files (sau `npm run build`).
- Reverse proxy `/api/` đến Node.js backend (port 3000).
- SSL termination (Let's Encrypt / Certbot).
- Gzip compression.
- Security headers bổ sung.

---

### 8. PDF Generation — Puppeteer

**Lựa chọn:** Puppeteer 21

**Lý do:** Render HTML template thành PDF bằng headless Chrome — output chất lượng cao, hỗ trợ tiếng Việt hoàn toàn (UTF-8, font đầy đủ).

**Thay thế nhẹ hơn:** `@react-pdf/renderer` (render PDF tại client, không cần Puppeteer trên server) — xem xét nếu server resource hạn chế.

---

### 9. Email — Nodemailer + SMTP

**Lựa chọn:** Nodemailer với SMTP bên thứ ba

**Recommended SMTP providers cho SME VN:**
- **Gmail** (free, limit 500 email/ngày) — phù hợp giai đoạn đầu.
- **SendGrid** (free 100 email/ngày) — professional, analytics.
- **Mailgun** (pay-as-you-go) — khi volume tăng.

---

### 10. Testing Stack

| Loại test | Công cụ |
|-----------|---------|
| Unit test (Backend) | Jest + ts-jest |
| Integration test (API) | Supertest + Jest |
| Database test | Prisma + PostgreSQL test database (Docker) |
| Unit test (Frontend) | Vitest + React Testing Library |
| E2E test | Playwright (optional, v1.1+) |

**Target coverage:** ≥ 80% cho Service layer (business logic).

---

## Summary — Full Tech Stack

```
┌─────────────────────────────────────────────────────────┐
│                    TECH STACK WSMS v1.0                 │
├──────────────┬──────────────────────────────────────────┤
│ Frontend     │ React 18 + TypeScript + Vite             │
│              │ TailwindCSS + shadcn/ui                  │
│              │ TanStack Query v5 + React Hook Form      │
│              │ Zustand + Zod + Axios                    │
├──────────────┼──────────────────────────────────────────┤
│ Backend      │ Node.js 20 LTS + Express 4 + TypeScript  │
│              │ Prisma 5 ORM + Zod validation            │
│              │ JWT (RS256) + bcrypt                     │
│              │ Pino logging + Helmet security           │
├──────────────┼──────────────────────────────────────────┤
│ Database     │ PostgreSQL 15+                           │
├──────────────┼──────────────────────────────────────────┤
│ Infrastructure│ Nginx (reverse proxy + static files)   │
│              │ PM2 (process manager, cluster mode)      │
│              │ Let's Encrypt (SSL)                      │
│              │ Docker Compose (development)             │
├──────────────┼──────────────────────────────────────────┤
│ PDF / Excel  │ Puppeteer (PDF) + ExcelJS (xlsx)        │
├──────────────┼──────────────────────────────────────────┤
│ Email        │ Nodemailer + SMTP (Gmail/SendGrid)       │
├──────────────┼──────────────────────────────────────────┤
│ Testing      │ Jest + Supertest + Vitest + RTL          │
└──────────────┴──────────────────────────────────────────┘
```

---

## Consequences

**Positive:**
- Toàn bộ stack dùng **TypeScript** — chia sẻ types (Zod schemas, API response types) giữa Frontend và Backend, giảm đáng kể lỗi contract.
- Stack phổ biến → dễ tuyển developer, tài nguyên học tập dồi dào.
- Nhẹ, deploy được trên VPS 2 CPU / 4 GB RAM.

**Negative / Trade-offs:**
- Puppeteer yêu cầu cài Chrome trên server — tốn ~200MB RAM khi render PDF đồng thời. Cần timeout và queue nếu nhiều yêu cầu PDF cùng lúc.
- Node.js single-threaded: CPU-heavy tasks (báo cáo lớn) sẽ block. Giải quyết bằng `worker_threads` hoặc offload query sang PostgreSQL (báo cáo dùng SQL thuần).
- Không có Redis: không có distributed cache hay job queue. Nếu nhu cầu tăng (cron jobs phức tạp, queue email), cần thêm BullMQ + Redis ở v2.0.

---

## Development Setup

```bash
# Prerequisites: Node.js 20+, Docker, Git

# 1. Clone và cài dependencies
git clone https://github.com/your-org/warehouse-system.git
cd warehouse-system

# 2. Khởi động PostgreSQL (Docker)
docker-compose up -d postgres

# 3. Backend setup
cd backend
cp .env.example .env          # Điền DATABASE_URL, JWT_PRIVATE_KEY, ...
npm install
npx prisma migrate dev        # Áp dụng schema, seed data
npm run dev                   # Khởi động dev server (port 3000)

# 4. Frontend setup (terminal mới)
cd frontend
cp .env.example .env          # VITE_API_BASE_URL=http://localhost:3000/api/v1
npm install
npm run dev                   # Khởi động Vite (port 5173)

# 5. Truy cập: http://localhost:5173
# Default admin: admin@wsms.local / Admin@123456
```

**Environment Variables — Backend (`.env`):**

```env
# Database
DATABASE_URL="postgresql://wsms:wsms_dev_pass@localhost:5432/wsms_dev"

# JWT (RSA keys — tạo bằng openssl)
JWT_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n..."
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n..."
JWT_ACCESS_TOKEN_TTL=900        # 15 phút (giây)
JWT_REFRESH_TOKEN_TTL=604800    # 7 ngày (giây)

# Server
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173

# Email (tùy chọn trong dev)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=app_password
SMTP_FROM="WSMS <your@gmail.com>"

# App
APP_URL=http://localhost:3000
```

**Tạo RSA keypair cho JWT:**
```bash
# Private key
openssl genrsa -out jwt_private.pem 2048

# Public key
openssl rsa -in jwt_private.pem -pubout -out jwt_public.pem
```

---

## Future Considerations (v2.0+)

| Thành phần | Phương án nâng cấp |
|------------|-------------------|
| Cache | Redis + BullMQ cho job queue (email, report generation) |
| Search | Elasticsearch nếu cần tìm kiếm full-text phức tạp |
| File storage | MinIO (S3-compatible) thay thế local filesystem |
| Monitoring | Prometheus + Grafana hoặc Datadog |
| CI/CD | GitHub Actions → deploy tự động |
| Container | Docker + Kubernetes nếu scale > 500 concurrent users |
| Mobile | React Native (code sharing với React web components) |
