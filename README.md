
# ValerPay

[![CI](../../actions/workflows/ci.yml/badge.svg)](../../actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)

**ValerPay** is a full-stack demo payment platform that models a real-world workflow: users create **deposit/withdraw** requests, and admins **review → approve/reject → complete** them. Balances are derived from an **append-only ledger** (**DEBIT/CREDIT**) instead of storing a mutable “balance” number.

<p align="center">
  <img src="docs/architecture.png" alt="ValerPay - High-level architecture" width="900" />
</p>

---

## Table of contents
- [Demo (local)](#demo-local)
- [Why ledger-based balances?](#why-ledger-based-balances)
- [Key features](#key-features)
- [Request lifecycle](#request-lifecycle)
- [Tech stack](#tech-stack)
- [Quickstart (local)](#quickstart-local)
- [Environment variables](#environment-variables)
- [Seeded demo accounts](#seeded-demo-accounts)
- [API quick reference](#api-quick-reference)
- [Screenshots](#screenshots)
- [Project structure](#project-structure)
- [Quality & CI](#quality--ci)
- [Roadmap](#roadmap)
- [AI assistance](#ai-assistance)
- [License](#license)

---

## Demo (local)

- API: `http://localhost:3001`
- Admin UI: `http://localhost:3000`
- User UI: `http://localhost:3002`

---

## Why ledger-based balances?

Most demos store a **mutable** `balance` number, which can become inconsistent under retries, concurrency, or partial failures.

ValerPay uses an **append-only ledger**:
- Every money movement is recorded as immutable **ledger lines** (DEBIT/CREDIT).
- The current balance is **derived** by summing ledger lines (audit-friendly).
- This approach is deterministic, traceable, and easier to reconcile.

---

## Key features

### Authentication & roles
- **Role-based access** (USER / ADMIN) with JWT
- Separate login flows:
  - User: register + login
  - Admin: login (seeded admins for local demo)

### User flows
- Register / login
- Create **deposit** and **withdraw** requests
- View **requests** and **derived balance**

### Admin flows
- Review requests
- **Claim** (assign to self)
- **Approve / reject**
- **Send / complete**
- Operational visibility:
  - Audit logs
  - Ledger entries
  - Daily report endpoint

### Config & safety
- Payment configuration flags (enable/disable deposits & withdraws per method)
- Input validation and consistent request status transitions
- Database schema + migrations versioned with Prisma

---

## Request lifecycle

Request statuses (high-level):
- `NEW` → `ASSIGNED` → `APPROVED` → `SENT` → `COMPLETED`
- `NEW/ASSIGNED` → `REJECTED`

Notes:
- Only admins can change request status.
- Ledger entry creation is tied to request completion (audit trail remains intact).

---

## Tech stack

- **Backend:** NestJS, Prisma, TypeScript, JWT, Jest
- **Database (local/demo):** SQLite
- **Frontend:** Next.js (Admin + User apps), TypeScript
- **Quality:** ESLint, GitHub Actions CI

---

## Quickstart (local)

### 1) Prerequisites
- Node.js (LTS recommended)
- (Optional) Git

### 2) Install dependencies (monorepo)
From repo root:
```bash
npm install
```

### 3) Create env files
Copy the template and create per-app env files:
```bash
cp .env.example src/backend/.env
cp .env.example src/frontend/admin/.env.local
cp .env.example src/frontend/user/.env.local
```

### 4) Configure the DB (recommended for local)
Open `src/backend/.env` and set SQLite DB path:
```bash
DATABASE_URL="file:./dev.db"
JWT_SECRET="change_me_to_any_long_string"
PORT=3001
CORS_ORIGINS="http://localhost:3000,http://localhost:3002"
NEXT_PUBLIC_API_URL="http://localhost:3001"
```

### 5) Initialize database (migrate + seed)
```bash
npm --workspace src/backend run db:migrate
npm --workspace src/backend run db:seed
```

### 6) Run (3 terminals)
Terminal 1 (API):
```bash
npm run dev:backend
```

Terminal 2 (Admin UI):
```bash
npm run dev:admin
```

Terminal 3 (User UI):
```bash
npm run dev:user
```

### 7) Sanity check
- Open Admin UI: `http://localhost:3000`
- Open User UI: `http://localhost:3002`
- API base: `http://localhost:3001`

---

## Environment variables

Template file: `.env.example`

### Backend (NestJS + Prisma)
- `DATABASE_URL`  
  SQLite demo example: `file:./dev.db`
- `JWT_SECRET`  
  Any long random string for local demo
- `PORT`  
  API port (default `3001`)
- `CORS_ORIGINS`  
  Comma-separated allowed origins (Admin + User UIs)

### Frontend (Next.js Admin/User)
- `NEXT_PUBLIC_API_URL`  
  API base URL used by both frontends

> Security note: never commit real secrets. `.env` files must stay local.

---

## Seeded demo accounts

For reviewer-friendly setup, the seed creates demo users/admins:

### Admin
- `admin@local.test` / `Admin123!` (role: ADMIN)
- `root@local.test` / `Root123!` (role: SUPER_ADMIN)

### User
- `gerard@local.test` / `User123!`

> These credentials are for local/demo only.

---

## API quick reference

Base URL (local): `http://localhost:3001`  
Auth: `Authorization: Bearer <JWT>`

### Auth
- `POST /auth/user/register`
- `POST /auth/user/login`
- `POST /auth/admin/login`

### User (requires USER JWT)
- `GET /user/me`
- `GET /user/config/payments`
- `GET /user/balance`
- `GET /user/requests`
- `POST /user/requests/deposit`
- `POST /user/requests/withdraw`

### Admin (requires ADMIN JWT)
- `GET /admin/config/payments`
- `POST /admin/config/payments`
- `GET /admin/requests`
- `GET /admin/requests/:id`
- `POST /admin/requests/:id/claim`
- `POST /admin/requests/:id/approve`
- `POST /admin/requests/:id/reject`
- `POST /admin/requests/:id/send`
- `POST /admin/requests/:id/request-sms`
- `POST /admin/requests/:id/complete`
- `POST /admin/users/:email/requests/withdraw`
- `GET /admin/logs`
- `GET /admin/ledger/entries`
- `GET /admin/reports/daily`

Full details: **`docs/api.md`**

---

## Screenshots


### Highlights
<p>
  <img src="docs/screenshots/01-admin-dashboard.png" width="320" alt="Admin dashboard" />
  <img src="docs/screenshots/02-admin-request-detail.png" width="320" alt="Admin request detail" />
  <img src="docs/screenshots/03-user-portal.png" width="320" alt="User portal" />
</p>

<p>
  <img src="docs/screenshots/04-user-create-request.png" width="320" alt="User create request" />
  <img src="docs/screenshots/05-ledger-entries.png" width="320" alt="Ledger entries" />
  <img src="docs/screenshots/06-daily-report.png" width="320" alt="Daily report" />
</p>

### More screenshots (optional)
<details>
  <summary><b>Click to expand</b></summary>

  <p>
    <img src="docs/screenshots/07-auth.png" width="320" alt="Auth" />
    <img src="docs/screenshots/08-payment-config.png" width="320" alt="Payment config" />
    <img src="docs/screenshots/09-audit-logs.png" width="320" alt="Audit logs" />
  </p>

  <p>
    <img src="docs/screenshots/10-request-status-flow.png" width="320" alt="Request status flow" />
    <img src="docs/screenshots/11-mobile-user.png" width="320" alt="Mobile view" />
    <img src="docs/screenshots/12-error-states.png" width="320" alt="Error states" />
  </p>
</details>

---

## Project structure

```txt
ValerPay/
  .github/workflows/ci.yml      # CI pipeline (lint/build/test)
  docs/
    architecture.png
    api.md
    decisions.md
    screenshots/
  src/
    backend/                    # NestJS API + Prisma
    frontend/
      admin/                    # Next.js Admin UI
      user/                     # Next.js User UI
  tests/                        # Test pointers / shared fixtures
  .env.example
  README.md
  LICENSE
  CHANGELOG.md
  CONTRIBUTING.md
  SECURITY.md
```

---

## Quality & CI

CI runs on every push/PR:
- `npm run lint`
- `npm run build`
- `npm test` (backend unit tests)

Local quality commands:
```bash
npm run lint
npm run build
npm test
```

---

## Roadmap

- Swagger/OpenAPI docs (versioned contract)
- End-to-end smoke test in CI (seeded DB)
- Frontend unit/component tests
- Optional Docker compose for full local stack

---

## AI assistance

This project was developed with AI assistance (ChatGPT) for brainstorming, refactoring suggestions, and debugging support.  
Final implementation, integration decisions, and testing were done by me.

**What I did myself**
- Designed the domain workflow (roles, request lifecycle, admin operations) and implemented it end-to-end.
- Implemented Prisma schema + migrations + seed and integrated it into the NestJS service layer.
- Wired the frontends to the API and structured the repo for reviewer-friendly setup (docs/tests/CI).

---

## License

MIT — see `LICENSE`.
