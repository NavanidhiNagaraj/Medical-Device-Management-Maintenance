from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from .database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(120), nullable=False)
    email = Column(String(180), unique=True, index=True, nullable=False)
    hashed_password = Column(String(256), nullable=False)
    role = Column(String(40), nullable=False, default="biomedical_engineer")
    department = Column(String(120), nullable=True, default="Biomedical Engineering")
    phone = Column(String(40), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=utc_now)


class Device(Base):
    __tablename__ = "devices"

    id = Column(Integer, primary_key=True, index=True)
    device_code = Column(String(40), unique=True, index=True, nullable=False)
    name = Column(String(150), nullable=False, index=True)
    category = Column(String(80), nullable=False, default="Patient Monitoring")
    model = Column(String(120), nullable=False)
    manufacturer = Column(String(120), nullable=False)
    serial_number = Column(String(120), unique=True, index=True, nullable=False)
    location = Column(String(150), nullable=False, index=True)
    operational_status = Column(String(40), nullable=False, default="Operational", index=True)
    criticality = Column(String(20), nullable=False, default="Medium")
    purchase_date = Column(Date, nullable=True)
    warranty_expiry = Column(Date, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=utc_now)
    updated_at = Column(DateTime, nullable=False, default=utc_now, onupdate=utc_now)

    maintenance_schedules = relationship(
        "MaintenanceSchedule",
        back_populates="device",
        cascade="all, delete-orphan",
    )
    service_records = relationship(
        "ServiceRecord",
        back_populates="device",
        cascade="all, delete-orphan",
    )
    downtime_logs = relationship(
        "DowntimeLog",
        back_populates="device",
        cascade="all, delete-orphan",
    )


class MaintenanceSchedule(Base):
    __tablename__ = "maintenance_schedules"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(180), nullable=False)
    maintenance_type = Column(String(60), nullable=False, default="Preventive Maintenance")
    scheduled_date = Column(Date, nullable=False, index=True)
    frequency_days = Column(Integer, nullable=False, default=90)
    reminder_days_before = Column(Integer, nullable=False, default=7)
    priority = Column(String(20), nullable=False, default="Medium")
    status = Column(String(30), nullable=False, default="Scheduled", index=True)
    assigned_engineer_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    assigned_engineer_name = Column(String(120), nullable=True)
    notes = Column(Text, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=utc_now)
    updated_at = Column(DateTime, nullable=False, default=utc_now, onupdate=utc_now)

    device = relationship("Device", back_populates="maintenance_schedules")


class ServiceRecord(Base):
    __tablename__ = "service_records"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, index=True)
    service_type = Column(String(60), nullable=False, default="Corrective Repair")
    service_date = Column(Date, nullable=False, index=True)
    fault_description = Column(Text, nullable=False)
    repair_details = Column(Text, nullable=False)
    severity = Column(String(20), nullable=False, default="Major")
    outcome = Column(String(40), nullable=False, default="Resolved")
    cost = Column(Float, nullable=False, default=0.0)
    engineer_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    engineer_name = Column(String(120), nullable=False)
    parts_replaced = Column(String(250), nullable=True)
    created_at = Column(DateTime, nullable=False, default=utc_now)

    device = relationship("Device", back_populates="service_records")


class DowntimeLog(Base):
    __tablename__ = "downtime_logs"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, index=True)
    unavailable_at = Column(DateTime, nullable=False, index=True)
    recovery_at = Column(DateTime, nullable=True)
    downtime_minutes = Column(Integer, nullable=True)
    reason = Column(Text, nullable=False)
    impact_level = Column(String(20), nullable=False, default="High")
    reported_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reported_by_name = Column(String(120), nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=utc_now)

    device = relationship("Device", back_populates="downtime_logs")
