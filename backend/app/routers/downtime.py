from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Device, DowntimeLog, ServiceRecord, User
from ..schemas import DowntimeCreate, DowntimeResponse, DowntimeUpdate
from ..security import get_current_user, require_admin

router = APIRouter(prefix="/api/downtime", tags=["Downtime Tracking"])


def _compute_minutes(unavailable_at: datetime, recovery_at: Optional[datetime]) -> int:
    end = recovery_at or datetime.now(timezone.utc).replace(tzinfo=None)
    seconds = max(0.0, (end - unavailable_at).total_seconds())
    if recovery_at is not None and seconds > 0:
        return max(1, int(round(seconds / 60)))
    return int(seconds // 60)


def _serialize_downtime(log: DowntimeLog, device: Device) -> DowntimeResponse:
    mins = log.downtime_minutes if log.downtime_minutes is not None else _compute_minutes(log.unavailable_at, log.recovery_at)
    return DowntimeResponse(
        id=log.id,
        device_id=log.device_id,
        device_code=device.device_code,
        device_name=device.name,
        device_location=device.location,
        unavailable_at=log.unavailable_at,
        recovery_at=log.recovery_at,
        downtime_minutes=mins,
        is_ongoing=log.recovery_at is None,
        reason=log.reason,
        impact_level=log.impact_level,
        reported_by_id=log.reported_by_id,
        reported_by_name=log.reported_by_name,
        notes=log.notes,
        created_at=log.created_at,
    )


@router.get("", response_model=list[DowntimeResponse])
def list_downtime_logs(
    device_id: Optional[int] = Query(None),
    ongoing_only: bool = Query(False),
    impact_level: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    query = db.query(DowntimeLog, Device).join(Device, DowntimeLog.device_id == Device.id)
    if device_id is not None:
        query = query.filter(DowntimeLog.device_id == device_id)
    if ongoing_only:
        query = query.filter(DowntimeLog.recovery_at.is_(None))
    if impact_level and impact_level != "All":
        query = query.filter(DowntimeLog.impact_level == impact_level)

    rows = query.order_by(DowntimeLog.unavailable_at.desc()).all()
    return [_serialize_downtime(log, d) for log, d in rows]


@router.get("/frequent-malfunctions")
def get_frequently_malfunctioning_devices(
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    devices = db.query(Device).all()
    logs = db.query(DowntimeLog).all()
    services = db.query(ServiceRecord).all()

    logs_by_device: dict[int, list[DowntimeLog]] = {}
    for l in logs:
        logs_by_device.setdefault(l.device_id, []).append(l)

    faults_by_device: dict[int, list[ServiceRecord]] = {}
    for s in services:
        if s.service_type in ("Corrective Repair", "Emergency Fault", "Parts Replacement"):
            faults_by_device.setdefault(s.device_id, []).append(s)

    results = []
    for d in devices:
        d_logs = logs_by_device.get(d.id, [])
        d_faults = faults_by_device.get(d.id, [])
        if not d_logs and not d_faults:
            continue

        total_mins = sum(
            l.downtime_minutes if l.downtime_minutes is not None else _compute_minutes(l.unavailable_at, l.recovery_at)
            for l in d_logs
        )
        outage_count = len(d_logs)
        fault_count = len(d_faults)
        incident_score = fault_count * 2 + outage_count
        avg_mins = round(total_mins / outage_count, 1) if outage_count > 0 else 0.0

        if fault_count >= 3 or outage_count >= 3 or total_mins >= 720:
            risk_level = "Critical"
        elif fault_count >= 2 or outage_count >= 2 or total_mins >= 240:
            risk_level = "High"
        else:
            risk_level = "Moderate"

        results.append(
            {
                "device_id": d.id,
                "device_code": d.device_code,
                "device_name": d.name,
                "location": d.location,
                "manufacturer": d.manufacturer,
                "operational_status": d.operational_status,
                "fault_count": fault_count,
                "outage_count": outage_count,
                "total_downtime_minutes": total_mins,
                "total_downtime_hours": round(total_mins / 60.0, 2),
                "avg_recovery_minutes": avg_mins,
                "risk_level": risk_level,
                "incident_score": incident_score,
            }
        )

    results.sort(key=lambda x: (x["incident_score"], x["total_downtime_minutes"]), reverse=True)
    return results


@router.post("", response_model=DowntimeResponse, status_code=status.HTTP_201_CREATED)
def create_downtime_log(
    payload: DowntimeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    device = db.query(Device).filter(Device.id == payload.device_id).first()
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target device not found.")

    unavail_naive = payload.unavailable_at.replace(tzinfo=None)
    recovery_naive = payload.recovery_at.replace(tzinfo=None) if payload.recovery_at else None

    if recovery_naive is not None and recovery_naive <= unavail_naive:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Recovery time must be strictly after unavailable time.",
        )

    downtime_mins = _compute_minutes(unavail_naive, recovery_naive) if recovery_naive is not None else None

    log = DowntimeLog(
        device_id=payload.device_id,
        unavailable_at=unavail_naive,
        recovery_at=recovery_naive,
        downtime_minutes=downtime_mins,
        reason=payload.reason.strip(),
        impact_level=payload.impact_level,
        reported_by_id=current_user.id,
        reported_by_name=current_user.full_name,
        notes=payload.notes,
    )
    db.add(log)

    if payload.update_device_status:
        if recovery_naive is None:
            device.operational_status = "Out of Service"
        elif device.operational_status == "Out of Service":
            device.operational_status = "Operational"

    db.commit()
    db.refresh(log)
    return _serialize_downtime(log, device)


@router.put("/{log_id}", response_model=DowntimeResponse)
def update_downtime_log(
    log_id: int,
    payload: DowntimeUpdate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    log = db.query(DowntimeLog).filter(DowntimeLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Downtime record not found.")

    device = db.query(Device).filter(Device.id == log.device_id).first()
    updates = payload.model_dump(exclude_unset=True, exclude={"restore_device_operational"})

    if "unavailable_at" in updates and updates["unavailable_at"] is not None:
        log.unavailable_at = updates["unavailable_at"].replace(tzinfo=None)
    if "recovery_at" in updates:
        log.recovery_at = updates["recovery_at"].replace(tzinfo=None) if updates["recovery_at"] else None
    if "reason" in updates and updates["reason"] is not None:
        log.reason = updates["reason"].strip()
    if "impact_level" in updates and updates["impact_level"] is not None:
        log.impact_level = updates["impact_level"]
    if "notes" in updates:
        log.notes = updates["notes"]

    if log.recovery_at is not None:
        if log.recovery_at <= log.unavailable_at:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Recovery time must be strictly after unavailable time.",
            )
        log.downtime_minutes = _compute_minutes(log.unavailable_at, log.recovery_at)
        if payload.restore_device_operational and device.operational_status in ("Out of Service", "Under Maintenance"):
            device.operational_status = "Operational"
    else:
        log.downtime_minutes = None

    db.commit()
    db.refresh(log)
    return _serialize_downtime(log, device)


@router.delete("/{log_id}")
def delete_downtime_log(
    log_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    log = db.query(DowntimeLog).filter(DowntimeLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Downtime record not found.")
    db.delete(log)
    db.commit()
    return {"message": "Downtime record deleted."}
