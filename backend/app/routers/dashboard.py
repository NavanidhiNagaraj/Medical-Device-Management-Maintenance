import csv
import io
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Device, DowntimeLog, MaintenanceSchedule, ServiceRecord, User
from ..security import get_current_user
from .downtime import _compute_minutes
from .maintenance import _serialize_maintenance

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard & Reports"])


@router.get("/overview")
def get_dashboard_overview(
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    devices = db.query(Device).all()
    schedules = db.query(MaintenanceSchedule, Device).join(Device, MaintenanceSchedule.device_id == Device.id).all()
    services = db.query(ServiceRecord, Device).join(Device, ServiceRecord.device_id == Device.id).all()
    downtimes = db.query(DowntimeLog, Device).join(Device, DowntimeLog.device_id == Device.id).all()

    total_devices = len(devices)
    status_counts = {
        "Operational": 0,
        "Under Maintenance": 0,
        "Out of Service": 0,
        "Calibration Due": 0,
    }
    category_counts: dict[str, int] = defaultdict(int)
    for d in devices:
        status_counts[d.operational_status] = status_counts.get(d.operational_status, 0) + 1
        category_counts[d.category] += 1

    operational_rate = round((status_counts["Operational"] / total_devices) * 100, 1) if total_devices else 0.0

    serialized_maint = [_serialize_maintenance(m, d) for m, d in schedules]
    overdue_alerts = [m for m in serialized_maint if m.is_overdue]
    due_soon_alerts = [m for m in serialized_maint if m.is_due_soon]
    upcoming_count = sum(1 for m in serialized_maint if m.status in ("Scheduled", "In Progress") and not m.is_overdue)
    completed_maint_count = sum(1 for m in serialized_maint if m.status == "Completed")

    # Downtime analytics
    total_downtime_minutes = 0
    active_outages = 0
    downtime_by_device: dict[str, dict] = {}
    monthly_downtime: dict[str, float] = defaultdict(float)

    for log, d in downtimes:
        mins = log.downtime_minutes if log.downtime_minutes is not None else _compute_minutes(log.unavailable_at, log.recovery_at)
        total_downtime_minutes += mins
        if log.recovery_at is None:
            active_outages += 1

        entry = downtime_by_device.setdefault(
            d.device_code,
            {"device_code": d.device_code, "device_name": d.name, "minutes": 0, "outages": 0},
        )
        entry["minutes"] += mins
        entry["outages"] += 1

        month_key = log.unavailable_at.strftime("%Y-%m")
        monthly_downtime[month_key] += mins / 60.0

    top_downtime_devices = sorted(
        [
            {
                "device_code": v["device_code"],
                "device_name": v["device_name"],
                "hours": round(v["minutes"] / 60.0, 2),
                "minutes": v["minutes"],
                "outages": v["outages"],
            }
            for v in downtime_by_device.values()
        ],
        key=lambda x: x["minutes"],
        reverse=True,
    )[:6]

    # Fault frequency analytics
    fault_by_device: dict[str, dict] = {}
    severity_counts = {"Critical": 0, "Major": 0, "Minor": 0}
    monthly_faults: dict[str, int] = defaultdict(int)
    total_service_cost = 0.0

    for svc, d in services:
        total_service_cost += svc.cost or 0.0
        severity_counts[svc.severity] = severity_counts.get(svc.severity, 0) + 1
        if svc.service_type in ("Corrective Repair", "Emergency Fault", "Parts Replacement"):
            f_entry = fault_by_device.setdefault(
                d.device_code,
                {"device_code": d.device_code, "device_name": d.name, "faults": 0},
            )
            f_entry["faults"] += 1
            monthly_faults[svc.service_date.strftime("%Y-%m")] += 1

    top_fault_devices = sorted(fault_by_device.values(), key=lambda x: x["faults"], reverse=True)[:6]

    # Build 6-month trend labels ending on current month
    today = date.today()
    trend_months: list[str] = []
    for offset in range(5, -1, -1):
        # approximate month stepping cleanly
        y = today.year
        m = today.month - offset
        while m <= 0:
            m += 12
            y -= 1
        trend_months.append(f"{y:04d}-{m:02d}")

    monthly_trend = [
        {
            "month": mk,
            "label": datetime.strptime(mk, "%Y-%m").strftime("%b %Y"),
            "downtime_hours": round(monthly_downtime.get(mk, 0.0), 2),
            "fault_count": monthly_faults.get(mk, 0),
        }
        for mk in trend_months
    ]

    high_risk_count = sum(1 for f in fault_by_device.values() if f["faults"] >= 2)

    return {
        "kpis": {
            "total_devices": total_devices,
            "operational_devices": status_counts["Operational"],
            "operational_rate": operational_rate,
            "under_maintenance": status_counts["Under Maintenance"],
            "out_of_service": status_counts["Out of Service"],
            "calibration_due": status_counts["Calibration Due"],
            "overdue_maintenance": len(overdue_alerts),
            "due_soon_maintenance": len(due_soon_alerts),
            "upcoming_maintenance": upcoming_count,
            "completed_maintenance": completed_maint_count,
            "total_downtime_hours": round(total_downtime_minutes / 60.0, 1),
            "active_outages": active_outages,
            "total_service_records": len(services),
            "total_service_cost": round(total_service_cost, 2),
            "high_risk_devices": high_risk_count,
        },
        "charts": {
            "operational_status": status_counts,
            "category_distribution": dict(category_counts),
            "severity_distribution": severity_counts,
            "top_downtime_devices": top_downtime_devices,
            "top_fault_devices": top_fault_devices,
            "monthly_trend": monthly_trend,
        },
        "alerts": {
            "overdue": [a.model_dump() for a in overdue_alerts[:8]],
            "due_soon": [a.model_dump() for a in due_soon_alerts[:8]],
        },
    }


@router.get("/export-report")
def export_devices_report(
    report_type: str = Query("devices", description="devices | maintenance | service | downtime"),
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    output = io.StringIO()
    writer = csv.writer(output)

    if report_type == "maintenance":
        writer.writerow(["Device ID", "Device Name", "Location", "Title", "Type", "Scheduled Date", "Priority", "Status", "Assigned Engineer"])
        rows = db.query(MaintenanceSchedule, Device).join(Device, MaintenanceSchedule.device_id == Device.id).order_by(MaintenanceSchedule.scheduled_date.asc()).all()
        for m, d in rows:
            writer.writerow([d.device_code, d.name, d.location, m.title, m.maintenance_type, m.scheduled_date.isoformat(), m.priority, m.status, m.assigned_engineer_name or ""])
        filename = "medwave_maintenance_report.csv"
    elif report_type == "service":
        writer.writerow(["Device ID", "Device Name", "Service Date", "Type", "Severity", "Outcome", "Cost ($)", "Engineer", "Fault Description", "Repair Details"])
        rows = db.query(ServiceRecord, Device).join(Device, ServiceRecord.device_id == Device.id).order_by(ServiceRecord.service_date.desc()).all()
        for s, d in rows:
            writer.writerow([d.device_code, d.name, s.service_date.isoformat(), s.service_type, s.severity, s.outcome, s.cost, s.engineer_name, s.fault_description, s.repair_details])
        filename = "medwave_service_history_report.csv"
    elif report_type == "downtime":
        writer.writerow(["Device ID", "Device Name", "Location", "Unavailable At", "Recovery At", "Downtime (Minutes)", "Impact", "Reason", "Reported By"])
        rows = db.query(DowntimeLog, Device).join(Device, DowntimeLog.device_id == Device.id).order_by(DowntimeLog.unavailable_at.desc()).all()
        for l, d in rows:
            mins = l.downtime_minutes if l.downtime_minutes is not None else _compute_minutes(l.unavailable_at, l.recovery_at)
            writer.writerow([d.device_code, d.name, d.location, l.unavailable_at.isoformat(), l.recovery_at.isoformat() if l.recovery_at else "Ongoing", mins, l.impact_level, l.reason, l.reported_by_name])
        filename = "medwave_downtime_report.csv"
    else:
        writer.writerow(["Device ID", "Name", "Category", "Model", "Manufacturer", "Serial Number", "Location", "Status", "Criticality", "Warranty Expiry"])
        devices = db.query(Device).order_by(Device.device_code.asc()).all()
        for d in devices:
            writer.writerow([d.device_code, d.name, d.category, d.model, d.manufacturer, d.serial_number, d.location, d.operational_status, d.criticality, d.warranty_expiry.isoformat() if d.warranty_expiry else ""])
        filename = "medwave_device_inventory_report.csv"

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
