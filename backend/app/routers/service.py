from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Device, ServiceRecord, User
from ..schemas import ServiceCreate, ServiceResponse, ServiceUpdate
from ..security import get_current_user, require_admin

router = APIRouter(prefix="/api/service-history", tags=["Service History"])


def _serialize_service(record: ServiceRecord, device: Device) -> ServiceResponse:
    return ServiceResponse(
        id=record.id,
        device_id=record.device_id,
        device_code=device.device_code,
        device_name=device.name,
        device_location=device.location,
        service_type=record.service_type,
        service_date=record.service_date,
        fault_description=record.fault_description,
        repair_details=record.repair_details,
        severity=record.severity,
        outcome=record.outcome,
        cost=record.cost,
        engineer_id=record.engineer_id,
        engineer_name=record.engineer_name,
        parts_replaced=record.parts_replaced,
        created_at=record.created_at,
    )


@router.get("", response_model=list[ServiceResponse])
def list_service_history(
    device_id: Optional[int] = Query(None),
    service_type: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    query = db.query(ServiceRecord, Device).join(Device, ServiceRecord.device_id == Device.id)

    if device_id is not None:
        query = query.filter(ServiceRecord.device_id == device_id)
    if service_type and service_type != "All":
        query = query.filter(ServiceRecord.service_type == service_type)
    if severity and severity != "All":
        query = query.filter(ServiceRecord.severity == severity)
    if search:
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Device.device_code.ilike(term),
                Device.name.ilike(term),
                ServiceRecord.fault_description.ilike(term),
                ServiceRecord.repair_details.ilike(term),
                ServiceRecord.engineer_name.ilike(term),
                ServiceRecord.parts_replaced.ilike(term),
            )
        )

    rows = query.order_by(ServiceRecord.service_date.desc(), ServiceRecord.id.desc()).all()
    return [_serialize_service(r, d) for r, d in rows]


@router.post("", response_model=ServiceResponse, status_code=status.HTTP_201_CREATED)
def create_service_record(
    payload: ServiceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    device = db.query(Device).filter(Device.id == payload.device_id).first()
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target device not found.")

    engineer_id = payload.engineer_id
    engineer_name = payload.engineer_name
    if engineer_id is not None:
        eng = db.query(User).filter(User.id == engineer_id).first()
        if not eng:
            raise HTTPException(status_code=404, detail="Selected engineer not found.")
        engineer_name = eng.full_name
    elif not engineer_name:
        engineer_id = current_user.id
        engineer_name = current_user.full_name

    record = ServiceRecord(
        device_id=payload.device_id,
        service_type=payload.service_type,
        service_date=payload.service_date,
        fault_description=payload.fault_description.strip(),
        repair_details=payload.repair_details.strip(),
        severity=payload.severity,
        outcome=payload.outcome,
        cost=payload.cost,
        engineer_id=engineer_id,
        engineer_name=engineer_name.strip(),
        parts_replaced=payload.parts_replaced.strip() if payload.parts_replaced else None,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return _serialize_service(record, device)


@router.put("/{record_id}", response_model=ServiceResponse)
def update_service_record(
    record_id: int,
    payload: ServiceUpdate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    record = db.query(ServiceRecord).filter(ServiceRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service record not found.")

    device = db.query(Device).filter(Device.id == record.device_id).first()
    updates = payload.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(record, key, value)

    db.commit()
    db.refresh(record)
    return _serialize_service(record, device)


@router.delete("/{record_id}")
def delete_service_record(
    record_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    record = db.query(ServiceRecord).filter(ServiceRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service record not found.")
    db.delete(record)
    db.commit()
    return {"message": "Service record deleted."}
