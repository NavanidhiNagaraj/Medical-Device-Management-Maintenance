from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Device, DowntimeLog, MaintenanceSchedule, ServiceRecord, User
from ..schemas import DeviceCreate, DeviceResponse, DeviceUpdate
from ..security import get_current_user, require_admin

router = APIRouter(prefix="/api/devices", tags=["Device Inventory"])


def _enrich_devices(devices: list[Device], db: Session) -> list[DeviceResponse]:
    if not devices:
        return []

    device_ids = [d.id for d in devices]

    fault_counts = dict(
        db.query(ServiceRecord.device_id, func.count(ServiceRecord.id))
        .filter(ServiceRecord.device_id.in_(device_ids))
        .group_by(ServiceRecord.device_id)
        .all()
    )

    upcoming_counts = dict(
        db.query(MaintenanceSchedule.device_id, func.count(MaintenanceSchedule.id))
        .filter(
            MaintenanceSchedule.device_id.in_(device_ids),
            MaintenanceSchedule.status.in_(["Scheduled", "In Progress", "Overdue"]),
        )
        .group_by(MaintenanceSchedule.device_id)
        .all()
    )

    downtime_rows = (
        db.query(DowntimeLog)
        .filter(DowntimeLog.device_id.in_(device_ids))
        .all()
    )
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    downtime_map: dict[int, int] = {}
    for log in downtime_rows:
        if log.downtime_minutes is not None:
            mins = log.downtime_minutes
        else:
            end = log.recovery_at or now
            mins = max(0, int((end - log.unavailable_at).total_seconds() // 60))
        downtime_map[log.device_id] = downtime_map.get(log.device_id, 0) + mins

    enriched: list[DeviceResponse] = []
    for d in devices:
        item = DeviceResponse.model_validate(d)
        item.fault_count = fault_counts.get(d.id, 0)
        item.total_downtime_minutes = downtime_map.get(d.id, 0)
        item.upcoming_maintenance_count = upcoming_counts.get(d.id, 0)
        enriched.append(item)
    return enriched


@router.get("", response_model=list[DeviceResponse])
def list_devices(
    search: Optional[str] = Query(None, description="Search by ID, name, model, manufacturer, serial, or location"),
    operational_status: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    location: Optional[str] = Query(None),
    criticality: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    query = db.query(Device)

    if search:
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Device.device_code.ilike(term),
                Device.name.ilike(term),
                Device.model.ilike(term),
                Device.manufacturer.ilike(term),
                Device.serial_number.ilike(term),
                Device.location.ilike(term),
                Device.category.ilike(term),
            )
        )
    if operational_status and operational_status != "All":
        query = query.filter(Device.operational_status == operational_status)
    if category and category != "All":
        query = query.filter(Device.category == category)
    if location and location != "All":
        query = query.filter(Device.location == location)
    if criticality and criticality != "All":
        query = query.filter(Device.criticality == criticality)

    devices = query.order_by(Device.device_code.asc()).all()
    return _enrich_devices(devices, db)


@router.get("/{device_id}", response_model=DeviceResponse)
def get_device(
    device_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found.")
    return _enrich_devices([device], db)[0]


@router.post("", response_model=DeviceResponse, status_code=status.HTTP_201_CREATED)
def create_device(
    payload: DeviceCreate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    if db.query(Device).filter(Device.device_code == payload.device_code).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Device ID '{payload.device_code}' is already registered.",
        )
    if db.query(Device).filter(Device.serial_number == payload.serial_number).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Serial number '{payload.serial_number}' is already assigned to another device.",
        )

    device = Device(**payload.model_dump())
    db.add(device)
    db.commit()
    db.refresh(device)
    return _enrich_devices([device], db)[0]


@router.put("/{device_id}", response_model=DeviceResponse)
def update_device(
    device_id: int,
    payload: DeviceUpdate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found.")

    updates = payload.model_dump(exclude_unset=True)

    if "device_code" in updates and updates["device_code"] != device.device_code:
        if db.query(Device).filter(Device.device_code == updates["device_code"], Device.id != device_id).first():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Device ID '{updates['device_code']}' is already in use.",
            )

    if "serial_number" in updates and updates["serial_number"] != device.serial_number:
        if db.query(Device).filter(Device.serial_number == updates["serial_number"], Device.id != device_id).first():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Serial number '{updates['serial_number']}' is already in use.",
            )

    for key, value in updates.items():
        setattr(device, key, value)

    db.commit()
    db.refresh(device)
    return _enrich_devices([device], db)[0]


@router.delete("/{device_id}", status_code=status.HTTP_200_OK)
def delete_device(
    device_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found.")

    code = device.device_code
    db.delete(device)
    db.commit()
    return {"message": f"Device '{code}' and its associated logs were permanently removed."}
