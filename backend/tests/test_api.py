from datetime import date, datetime, timedelta, timezone


def auth_headers(client, email: str, password: str) -> dict[str, str]:
    resp = client.post("/api/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200, resp.text
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_health_and_seeded_login(client):
    health = client.get("/api/health")
    assert health.status_code == 200
    assert health.json()["status"] == "healthy"

    headers = auth_headers(client, "admin@medwave.org", "Admin@123")
    me = client.get("/api/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["role"] == "admin"


def test_registration_profile_and_rbac(client):
    reg = client.post(
        "/api/auth/register",
        json={
            "full_name": "Jordan Lee",
            "email": "jordan.lee@hospital.org",
            "password": "Password123!",
            "role": "biomedical_engineer",
            "department": "OR Support",
        },
    )
    assert reg.status_code == 201
    eng_headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}

    # Duplicate email blocked
    dup = client.post(
        "/api/auth/register",
        json={
            "full_name": "Jordan Two",
            "email": "jordan.lee@hospital.org",
            "password": "Password123!",
        },
    )
    assert dup.status_code == 409

    # Profile update & password change
    upd = client.put(
        "/api/auth/me",
        headers=eng_headers,
        json={"department": "ICU Biomedical Support", "phone": "+1-555-0199"},
    )
    assert upd.status_code == 200
    assert upd.json()["department"] == "ICU Biomedical Support"

    pwd = client.put(
        "/api/auth/change-password",
        headers=eng_headers,
        json={"current_password": "Password123!", "new_password": "NewPassword123!"},
    )
    assert pwd.status_code == 200

    # New password works
    new_headers = auth_headers(client, "jordan.lee@hospital.org", "NewPassword123!")

    # Engineer cannot list/manage users
    forbidden = client.get("/api/auth/users", headers=new_headers)
    assert forbidden.status_code == 403

    # Admin can list users
    admin_headers = auth_headers(client, "admin@medwave.org", "Admin@123")
    users = client.get("/api/auth/users", headers=admin_headers)
    assert users.status_code == 200
    assert len(users.json()) >= 4


def test_device_inventory_crud_and_uniqueness(client):
    admin_headers = auth_headers(client, "admin@medwave.org", "Admin@123")
    eng_headers = auth_headers(client, "engineer@medwave.org", "Engineer@123")

    # Create device as engineer
    created = client.post(
        "/api/devices",
        headers=eng_headers,
        json={
            "device_code": "MED-TEST-900",
            "name": "Evita V800 Ventilator",
            "category": "Life Support",
            "model": "Evita V800",
            "manufacturer": "Drager",
            "serial_number": "SN-DR-99001",
            "location": "ICU - Bay 9",
            "operational_status": "Operational",
            "criticality": "High",
        },
    )
    assert created.status_code == 201
    device_id = created.json()["id"]

    # Duplicate device_code rejected
    dup_code = client.post(
        "/api/devices",
        headers=eng_headers,
        json={
            "device_code": "MED-TEST-900",
            "name": "Another Device",
            "model": "M1",
            "manufacturer": "Drager",
            "serial_number": "SN-UNIQUE-1",
            "location": "ER",
        },
    )
    assert dup_code.status_code == 409

    # Edit device
    edited = client.put(
        f"/api/devices/{device_id}",
        headers=eng_headers,
        json={"location": "ICU - Bay 10", "operational_status": "Under Maintenance"},
    )
    assert edited.status_code == 200
    assert edited.json()["location"] == "ICU - Bay 10"

    # Engineer cannot permanently delete device
    forbidden_del = client.delete(f"/api/devices/{device_id}", headers=eng_headers)
    assert forbidden_del.status_code == 403

    # Admin can delete device
    deleted = client.delete(f"/api/devices/{device_id}", headers=admin_headers)
    assert deleted.status_code == 200


def test_maintenance_reminders_and_recurrence(client):
    headers = auth_headers(client, "engineer@medwave.org", "Engineer@123")
    devices = client.get("/api/devices", headers=headers).json()
    target_id = devices[0]["id"]

    # Schedule due-soon PM
    soon_date = (date.today() + timedelta(days=2)).isoformat()
    created = client.post(
        "/api/maintenance",
        headers=headers,
        json={
            "device_id": target_id,
            "title": "Biomedical Electrical Safety Test",
            "maintenance_type": "Safety Inspection",
            "scheduled_date": soon_date,
            "frequency_days": 90,
            "reminder_days_before": 7,
            "priority": "High",
        },
    )
    assert created.status_code == 201
    sched_id = created.json()["id"]
    assert created.json()["is_due_soon"] is True

    # Alerts endpoint includes overdue + due soon
    alerts = client.get("/api/maintenance/alerts", headers=headers).json()
    assert alerts["overdue_count"] >= 1
    assert alerts["due_soon_count"] >= 1

    # Complete maintenance -> auto-schedules next 90d cycle
    before_count = len(client.get(f"/api/maintenance?device_id={target_id}", headers=headers).json())
    completed = client.put(
        f"/api/maintenance/{sched_id}",
        headers=headers,
        json={"status": "Completed", "auto_schedule_next": True},
    )
    assert completed.status_code == 200
    assert completed.json()["status"] == "Completed"

    after_count = len(client.get(f"/api/maintenance?device_id={target_id}", headers=headers).json())
    assert after_count == before_count + 1


def test_service_history_downtime_and_dashboard(client):
    headers = auth_headers(client, "engineer@medwave.org", "Engineer@123")
    devices = client.get("/api/devices", headers=headers).json()
    dev = devices[0]

    # Record service repair
    svc = client.post(
        "/api/service-history",
        headers=headers,
        json={
            "device_id": dev["id"],
            "service_type": "Corrective Repair",
            "service_date": date.today().isoformat(),
            "fault_description": "Expiratory valve pressure sensor drift",
            "repair_details": "Cleaned membrane and calibrated pressure transducer",
            "severity": "Major",
            "outcome": "Resolved",
            "cost": 145.5,
            "parts_replaced": "Valve Seal",
        },
    )
    assert svc.status_code == 201

    # Record downtime with invalid recovery time -> 422
    now = datetime.now(timezone.utc).replace(tzinfo=None, microsecond=0)
    bad_dt = client.post(
        "/api/downtime",
        headers=headers,
        json={
            "device_id": dev["id"],
            "unavailable_at": now.isoformat(),
            "recovery_at": (now - timedelta(hours=1)).isoformat(),
            "reason": "Invalid range test",
        },
    )
    assert bad_dt.status_code == 422

    # Record ongoing downtime -> updates device status to Out of Service
    open_dt = client.post(
        "/api/downtime",
        headers=headers,
        json={
            "device_id": dev["id"],
            "unavailable_at": (now - timedelta(minutes=95)).isoformat(),
            "reason": "Power supply fault",
            "impact_level": "High",
            "update_device_status": True,
        },
    )
    assert open_dt.status_code == 201
    dt_id = open_dt.json()["id"]
    assert open_dt.json()["is_ongoing"] is True

    # Recover downtime -> calculates minutes and restores Operational status
    recovered = client.put(
        f"/api/downtime/{dt_id}",
        headers=headers,
        json={"recovery_at": now.isoformat(), "restore_device_operational": True},
    )
    assert recovered.status_code == 200
    assert recovered.json()["is_ongoing"] is False
    assert recovered.json()["downtime_minutes"] == 95

    # Frequent malfunctions ranking
    freq = client.get("/api/downtime/frequent-malfunctions", headers=headers)
    assert freq.status_code == 200
    assert len(freq.json()) >= 1

    # Dashboard overview & CSV export
    overview = client.get("/api/dashboard/overview", headers=headers)
    assert overview.status_code == 200
    data = overview.json()
    assert data["kpis"]["total_devices"] >= 10
    assert "monthly_trend" in data["charts"]

    csv_resp = client.get("/api/dashboard/export-report?report_type=devices", headers=headers)
    assert csv_resp.status_code == 200
    assert "MED-ICU-001" in csv_resp.text
