from datetime import date, datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Device, MaintenanceSchedule, User
from ..schemas import MaintenanceCreate, MaintenanceResponse, MaintenanceUpdate
from ..security import get_current_user, require_admin

router = APIRouter(prefix="/api/maintenance", tags=["Maintenance & Reminders"])


def _serialize_maintenance(item: MaintenanceSchedule, device: Device) -> MaintenanceResponse:
    today = date.today()
    days_until = (item.scheduled_date - today).days
    active_open = item.status in ("Scheduled", "In Progress", "Overdue")
    is_overdue = active_open and days_until < 0
    is_due_soon = active_open and 0 <= days_until <= item.reminder_days_before

    effective_status = item.status
    if is_overdue:
        effective_status = "Overdue"

    return MaintenanceResponse(
        id=item.id,
        device_id=item.device_id,
        device_code=device.device_code,
        device_name=device.name,
        device_location=device.location,
        title=item.title,
        maintenance_type=item.maintenance_type,
        scheduled_date=item.scheduled_date,
        frequency_days=item.frequency_days,
        reminder_days_before=item.reminder_days_before,
        priority=item.priority,
        status=item.status,
        effective_status=effective_status,
        is_overdue=is_overdue,
        is_due_soon=is_due_soon,
        days_until_due=days_until,
        assigned_engineer_id=item.assigned_engineer_id,
        assigned_engineer_name=item.assigned_engineer_name,
        notes=item.notes,
        completed_at=item.completed_at,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


@router.get("", response_model=list[MaintenanceResponse])
def list_maintenance(
    filter_mode: Optional[str] = Query(
        "all",
        description="Filter: all, upcoming, overdue, due_soon, in_progress, completed",
    ),
    device_id: Optional[int] = Query(None),
    priority: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    query = db.query(MaintenanceSchedule, Device).join(Device, MaintenanceSchedule.device_id == Device.id)
    if device_id is not None:
        query = query.filter(MaintenanceSchedule.device_id == device_id)
    if priority and priority != "All":
        query = query.filter(MaintenanceSchedule.priority == priority)

    rows = query.order_by(MaintenanceSchedule.scheduled_date.asc()).all()
    items = [_serialize_maintenance(m, d) for m, d in rows]

    if filter_mode == "overdue":
        items = [i for i in items if i.is_overdue]
    elif filter_mode == "due_soon":
        items = [i for i in items if i.is_due_soon]
    elif filter_mode == "upcoming":
        items = [i for i in items if i.status in ("Scheduled", "In Progress") and not i.is_overdue]
    elif filter_mode == "in_progress":
        items = [i for i in items if i.status == "In Progress"]
    elif filter_mode == "completed":
        items = [i for i in items if i.status == "Completed"]

    return items


@router.get("/alerts")
def get_maintenance_alerts(
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    rows = (
        db.query(MaintenanceSchedule, Device)
        .join(Device, MaintenanceSchedule.device_id == Device.id)
        .filter(MaintenanceSchedule.status.in_(["Scheduled", "In Progress", "Overdue"]))
        .order_by(MaintenanceSchedule.scheduled_date.asc())
        .all()
    )
    serialized = [_serialize_maintenance(m, d) for m, d in rows]
    overdue = [i for i in serialized if i.is_overdue]
    due_soon = [i for i in serialized if i.is_due_soon]
    return {
        "overdue_count": len(overdue),
        "due_soon_count": len(due_soon),
        "total_alerts": len(overdue) + len(due_soon),
        "overdue": overdue,
        "due_soon": due_soon,
    }


@router.post("", response_model=MaintenanceResponse, status_code=status.HTTP_201_CREATED)
def schedule_maintenance(
    payload: MaintenanceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    device = db.query(Device).filter(Device.id == payload.device_id).first()
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target device not found.")

    engineer_id = payload.assigned_engineer_id
    engineer_name = payload.assigned_engineer_name
    if engineer_id is not None:
        eng = db.query(User).filter(User.id == engineer_id).first()
        if not eng:
            raise HTTPException(status_code=404, detail="Assigned engineer not found.")
        engineer_name = eng.full_name
    elif not engineer_name:
        engineer_id = current_user.id
        engineer_name = current_user.full_name

    schedule = MaintenanceSchedule(
        device_id=payload.device_id,
        title=payload.title.strip(),
        maintenance_type=payload.maintenance_type,
        scheduled_date=payload.scheduled_date,
        frequency_days=payload.frequency_days,
        reminder_days_before=payload.reminder_days_before,
        priority=payload.priority,
        status=payload.status,
        assigned_engineer_id=engineer_id,
        assigned_engineer_name=engineer_name,
        notes=payload.notes,
    )
    db.add(schedule)
    db.commit()
    db.refresh(schedule)
    return _serialize_maintenance(schedule, device)


@router.put("/{schedule_id}", response_model=MaintenanceResponse)
def update_maintenance(
    schedule_id: int,
    payload: MaintenanceUpdate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    schedule = db.query(MaintenanceSchedule).filter(MaintenanceSchedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Maintenance schedule not found.")

    device = db.query(Device).filter(Device.id == schedule.device_id).first()
    previous_status = schedule.status
    updates = payload.model_dump(exclude_unset=True, exclude={"auto_schedule_next", "set_device_operational"})

    if "assigned_engineer_id" in updates and updates["assigned_engineer_id"] is not None:
        eng = db.query(User).filter(User.id == updates["assigned_engineer_id"]).first()
        if not eng:
            raise HTTPException(status_code=404, detail="Assigned engineer not found.")
        updates["assigned_engineer_name"] = eng.full_name

    for key, value in updates.items():
        setattr(schedule, key, value)

    if schedule.status == "In Progress" and previous_status != "In Progress":
        if device.operational_status == "Operational":
            device.operational_status = "Under Maintenance"

    if schedule.status == "Completed" and previous_status != "Completed":
        schedule.completed_at = datetime.now(timezone.utc).replace(tzinfo=None)
        if payload.set_device_operational and device.operational_status in ("Under Maintenance", "Calibration Due"):
            device.operational_status = "Operational"

        if payload.auto_schedule_next and schedule.frequency_days > 0:
            next_date = date.today() + timedelta(days=schedule.frequency_days)
            next_item = MaintenanceSchedule(
                device_id=schedule.device_id,
                title=schedule.title,
                maintenance_type=schedule.maintenance_type,
                scheduled_date=next_date,
                frequency_days=schedule.frequency_days,
                reminder_days_before=schedule.reminder_days_before,
                priority=schedule.priority,
                status="Scheduled",
                assigned_engineer_id=schedule.assigned_engineer_id,
                assigned_engineer_name=schedule.assigned_engineer_name,
                notes=f"Auto-scheduled next cycle ({schedule.frequency_days}d) after completion.",
            )
            db.add(next_item)

    db.commit()
    db.refresh(schedule)
    db.refresh(device)
    return _serialize_maintenance(schedule, device)


@router.delete("/{schedule_id}")
def delete_maintenance(
    schedule_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    schedule = db.query(MaintenanceSchedule).filter(MaintenanceSchedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Maintenance schedule not found.")
    db.delete(schedule)
    db.commit()
    return {"message": "Maintenance schedule deleted."}
