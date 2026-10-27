# DishHome Internet Door-to-Door (D2D) Field Operations & Reporting System

A production-ready, responsive enterprise web application built for managing the DishHome Internet D2D customer visit team. It replaces manual Excel reporting with automated workflows, batch customer uploads, dynamic agent allocations, mobile-friendly GPS visit logging, and real-time supervisor analytics.

Styled to match the **DishHome Operation Support System** design language (`#F44336` brand red, `#E9CFCF` soft pink login background, white rounded cards, and Material-style input fields).

---

## 1. System Architecture & Tech Stack

- **Frontend**:
  - React 19 + TypeScript + Vite
  - Tailwind CSS with DishHome brand tokens
  - Recharts for supervisor analytics
  - Lucide React icons
  - Browser Geolocation API for visit verification
- **Backend**:
  - Python 3.12+ & Django 5.x
  - Django REST Framework with versioned routes (`/api/v1/`)
  - Token-based & Session authentication
  - OpenAPI 3.0 / Swagger documentation via `drf-spectacular`
  - `openpyxl` for Excel template generation, validation, and multi-report exports
- **Database**:
  - PostgreSQL for hosted deployments (Supabase free tier for prototype)
  - Zero-setup SQLite fallback for local development

---

## 2. Default Login Credentials (Seeded Demo Accounts)

| Role | Username | Password | Full Name / Description |
|---|---|---|---|
| **System Administrator** | `admin` | `Admin@123` | System Administrator |
| **Supervisor** | `supervisor1` | `Super@123` | Prakash Acharya (D2D Supervisor) |
| **D2D Agent 1** | `agent1` | `Agent@123` | Bikash Shrestha |
| **D2D Agent 2** | `agent2` | `Agent@123` | Sunita Maharjan |
| **D2D Agent 3** | `agent3` | `Agent@123` | Kiran KC |

---

## 3. Quick Start (Local Development)

### A. Run Django Backend
```bash
cd backend
python -m pip install -r requirements.txt
python manage.py migrate
python seed_demo_data.py
python manage.py runserver 0.0.0.0:8000
```
- API Base URL: `http://127.0.0.1:8000/api/v1/`
- Swagger UI Documentation: `http://127.0.0.1:8000/api/docs/`
- Django Admin: `http://127.0.0.1:8000/admin/`

### B. Run React Frontend
```bash
cd frontend
npm install --legacy-peer-deps
npm run dev
```
- App URL: `http://localhost:5173/`

---

## 4. Run with Docker Compose

```bash
docker-compose up --build
```
- Frontend will be available on: `http://localhost/`
- Backend API will be available on: `http://localhost:8000/`

---

## 5. Core Business Workflows

### 1. Excel Upload & Batch Preview (Supervisor)
- Navigate to **Customer Uploads**.
- Download standard 5-column template (`Customer ID`, `Customer Name`, `Phone Number`, `No. of Churn Days`, `Package`).
- Upload `.xlsx` file -> review duplicate detection, row errors, and validation summary.
- Click **Confirm Import** -> creates `ImportBatch` and displays the **Allocate Team** button.

### 2. Customer Allocation Workflow
- Navigate to **Customer Allocation** or click **Allocate Team** directly from an import batch.
- Supports:
  - **Individual Allocation**: select agent from dropdown on any customer row.
  - **Bulk Single Allocation**: check multiple rows -> assign to selected agent.
  - **Bulk Even Distribution**: check multiple rows -> select multiple agents -> click **Distribute Evenly** (round-robin assignment).
  - **Reassignment**: click "Reassign" on any allocated row, specify the new agent and reason (stored in immutable audit trail).

### 3. Agent Mobile Field Operations
- Log in on mobile phone (`agent1` / `Agent@123`).
- View assigned customer list, churn days, and telephone links (`tel:...`).
- Open customer -> click **Record Visit**.
- Select from 19 standardized Follow-up Remarks.
- If customer is switching ISP: conditionally selects Destination ISP (9 choices) and Switching Reason (9 choices).
- Captures verified GPS coordinates using browser Geolocation API.
- Schedules follow-up commitments (due today / upcoming / overdue).
- Adds manual field customers not present in supervisor list (`AGENT_MANUAL` pending review).

### 4. Supervisor Analytics & Exports
- Live KPI cards: Total Customers, Assigned, Unassigned, Unique Customers Visited, Overdue Follow-ups, GPS-captured visits.
- Interactive Recharts trends & competitor switching charts.
- Export filtered reports to Excel (.xlsx) and CSV:
  - Customer Allocation Report
  - Visit Findings Report (includes GPS)
  - Agent Performance Report
  - Churn Analysis Report

---

## 6. Database Backup & Restore

### Backup
```bash
# PostgreSQL
pg_dump -U postgres -d dishhome_d2d > backup_$(date +%Y%m%d).sql

# SQLite (Local Dev)
cp backend/db.sqlite3 backend/db_backup_$(date +%Y%m%d).sqlite3
```

### Restore
```bash
# PostgreSQL
psql -U postgres -d dishhome_d2d < backup_20261026.sql

# SQLite (Local Dev)
cp backend/db_backup_20261026.sqlite3 backend/db.sqlite3
```

---

## 7. Production Readiness Checklist

- [x] Django `DEBUG=False` configurable via environment variables
- [x] Unique Customer ID database constraint & duplicate detection
- [x] Single active assignment per customer constraint (`unique_active_assignment_per_customer`)
- [x] Strict role-based permissions (`ADMIN`, `SUPERVISOR`, `AGENT`)
- [x] CSRF and CORS protections
- [x] Password change workflows and token invalidation on logout
- [x] Audit trail recording user logins, imports, allocations, reassignments, and visit logs
- [x] Browser GPS permission handling with non-fabrication guarantee
- [x] Dockerfile and Docker Compose configurations

## 8. Cloud Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the prepared free-tier Vercel frontend, Render Django API, Supabase PostgreSQL, and private Supabase Storage configuration. No cloud resources are created by these files; deployment and credentials must be configured in the corresponding provider dashboards. Free-tier limits make this suitable for testing, not dependable business production.
