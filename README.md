# MedWave CMMS — Medical Device Management & Maintenance System

A full-stack hospital biomedical engineering CMMS (Computerized Maintenance Management System) built with **React.js**, **Python FastAPI**, **SQLite**, and **Chart.js**, featuring a TrackerWave-inspired healthcare dashboard.

## Features

1. **Authentication & Role-Based Access Control (RBAC)**
   - User registration, JWT login, profile editing, and password updates
   - **Roles:** `admin` (full asset & staff role management, permanent deletions) and `biomedical_engineer` (inventory, PM scheduling, service repairs, downtime tracking)
   - Admin staff management panel to activate/deactivate users or update roles

2. **Device Inventory Management**
   - Register, search, filter, edit, and delete medical devices
   - Unique **Device ID** (`device_code`) and **Serial Number** enforcement
   - Tracks name, category, model, manufacturer, serial number, hospital location, operational status (`Operational`, `Under Maintenance`, `Out of Service`, `Calibration Due`), criticality, purchase date, and warranty expiry
   - **Device 360° Inspection Modal** displaying linked maintenance schedules, service history, and downtime events

3. **Preventive Maintenance & Reminders**
   - Schedule preventive maintenance, calibrations, safety inspections, and firmware updates
   - Automatic **Overdue** and **Due Soon** reminder detection based on configurable lead-time windows
   - Status transitions (`Scheduled` → `In Progress` → `Completed`) with automatic device status updates and optional **auto-scheduling of the next recurring PM cycle**

4. **Service & Fault History**
   - Record corrective repairs, emergency faults, parts replacements, preventive services, and calibrations
   - Captures service date, severity (`Critical`, `Major`, `Minor`), fault description, repair details, replaced parts, cost, outcome, and certifying engineer

5. **Downtime Tracking & Malfunction Analytics**
   - Log device unavailable and recovery timestamps (including ongoing outages)
   - Automatic downtime duration calculation (minutes/hours) and device status synchronization
   - **Frequently Malfunctioning Devices** watchlist ranking high-risk assets by fault frequency, outage count, cumulative downtime, and MTTR

6. **Dashboard & Reports (Chart.js)**
   - Live fleet KPIs (Total Devices, Operational Rate, Maintenance Alerts, Cumulative Downtime, Frequent Fault Assets)
   - Interactive **Chart.js** visualizations: Operational Status Doughnut, 6-Month Downtime & Fault Trend, Top Downtime Devices, Fault Frequency by Device, Category Distribution, and Severity Breakdown
   - Printable report view and **CSV Exports** for Inventory, Maintenance, Service History, and Downtime logs

---

## Tech Stack

- **Frontend:** React 18, Vite, React Router, Chart.js (`react-chartjs-2`), Lucide Icons
- **Backend:** Python, FastAPI, SQLAlchemy 2.x, Pydantic v2, PyJWT
- **Database:** SQLite (`backend/medwave.db`, auto-created and seeded on first startup)

---

## Demo Credentials (Pre-Seeded Sample Data)

These credentials are public demo accounts for local evaluation only. Do not use them in a deployed or production environment.

On first startup, the backend automatically seeds 3 staff accounts, 10 hospital medical devices, 8 maintenance schedules, 10 service records, and 7 downtime logs:

| Role | Email | Password |
| :--- | :--- | :--- |
| **Administrator** | `admin@medwave.org` | `Admin@123` |
| **Biomedical Engineer** | `engineer@medwave.org` | `Engineer@123` |
| **Biomedical Engineer** | `priya.nair@medwave.org` | `Engineer@123` |

---

## Setup & Running Locally

### 1. Backend (FastAPI + SQLite)

```bash
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
# source .venv/bin/activate

pip install -r requirements.txt
# Set a private signing key before starting the API (PowerShell):
$env:JWT_SECRET = "replace-with-a-long-random-private-value"
uvicorn app.main:app --reload --port 8000
```

The API refuses to start if `JWT_SECRET` is missing. Keep the real value in your environment or a local `.env` file that is never committed.

API documentation will be available at `http://localhost:8000/docs`.

### 2. Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your browser. Vite automatically proxies `/api/*` requests to `http://127.0.0.1:8000`.

### 3. Running Backend Tests

```bash
cd backend
pytest -v
```
