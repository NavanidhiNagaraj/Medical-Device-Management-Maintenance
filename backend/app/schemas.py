from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

UserRole = Literal["admin", "biomedical_engineer"]
OperationalStatus = Literal["Operational", "Under Maintenance", "Out of Service", "Calibration Due"]
CriticalityLevel = Literal["High", "Medium", "Low"]
MaintenanceType = Literal["Preventive Maintenance", "Calibration", "Safety Inspection", "Firmware Update"]
MaintenancePriority = Literal["Critical", "High", "Medium", "Low"]
MaintenanceStatus = Literal["Scheduled", "In Progress", "Completed", "Overdue", "Cancelled"]
ServiceType = Literal["Corrective Repair", "Preventive Service", "Emergency Fault", "Calibration", "Parts Replacement"]
SeverityLevel = Literal["Critical", "Major", "Minor"]
ServiceOutcome = Literal["Resolved", "Pending Parts", "Escalated to Vendor"]
ImpactLevel = Literal["Critical", "High", "Medium", "Low"]


# ---------- Auth & User Schemas ----------

class UserRegister(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)
    role: UserRole = "biomedical_engineer"
    department: Optional[str] = Field("Biomedical Engineering", max_length=120)
    phone: Optional[str] = Field(None, max_length=40)

    @field_validator("full_name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        cleaned = v.strip()
        if len(cleaned) < 2:
            raise ValueError("Full name must be at least 2 characters.")
        return cleaned


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1)


class UserProfileUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2, max_length=120)
    email: Optional[EmailStr] = None
    department: Optional[str] = Field(None, max_length=120)
    phone: Optional[str] = Field(None, max_length=40)


class PasswordChange(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=6, max_length=128)


class AdminUserRoleUpdate(BaseModel):
    role: UserRole
    is_active: Optional[bool] = None


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    email: EmailStr
    role: str
    department: Optional[str] = None
    phone: Optional[str] = None
    is_active: bool
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# ---------- Device Inventory Schemas ----------

class DeviceBase(BaseModel):
    device_code: str = Field(..., min_length=2, max_length=40, description="Unique Device ID e.g. MED-ICU-001")
    name: str = Field(..., min_length=2, max_length=150)
    category: str = Field("Patient Monitoring", min_length=2, max_length=80)
    model: str = Field(..., min_length=1, max_length=120)
    manufacturer: str = Field(..., min_length=1, max_length=120)
    serial_number: str = Field(..., min_length=2, max_length=120)
    location: str = Field(..., min_length=2, max_length=150)
    operational_status: OperationalStatus = "Operational"
    criticality: CriticalityLevel = "Medium"
    purchase_date: Optional[date] = None
    warranty_expiry: Optional[date] = None
    notes: Optional[str] = None

    @field_validator("device_code", "serial_number")
    @classmethod
    def normalize_code(cls, v: str) -> str:
        return v.strip().upper()

    @field_validator("name", "model", "manufacturer", "location", "category")
    @classmethod
    def strip_text(cls, v: str) -> str:
        return v.strip()


class DeviceCreate(DeviceBase):
    pass


class DeviceUpdate(BaseModel):
    device_code: Optional[str] = Field(None, min_length=2, max_length=40)
    name: Optional[str] = Field(None, min_length=2, max_length=150)
    category: Optional[str] = Field(None, min_length=2, max_length=80)
    model: Optional[str] = Field(None, min_length=1, max_length=120)
    manufacturer: Optional[str] = Field(None, min_length=1, max_length=120)
    serial_number: Optional[str] = Field(None, min_length=2, max_length=120)
    location: Optional[str] = Field(None, min_length=2, max_length=150)
    operational_status: Optional[OperationalStatus] = None
    criticality: Optional[CriticalityLevel] = None
    purchase_date: Optional[date] = None
    warranty_expiry: Optional[date] = None
    notes: Optional[str] = None

    @field_validator("device_code", "serial_number")
    @classmethod
    def normalize_code(cls, v: Optional[str]) -> Optional[str]:
        return v.strip().upper() if v is not None else None


class DeviceResponse(DeviceBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime
    fault_count: int = 0
    total_downtime_minutes: int = 0
    upcoming_maintenance_count: int = 0


# ---------- Maintenance Schemas ----------

class MaintenanceCreate(BaseModel):
    device_id: int
    title: str = Field(..., min_length=3, max_length=180)
    maintenance_type: MaintenanceType = "Preventive Maintenance"
    scheduled_date: date
    frequency_days: int = Field(90, ge=0, le=1825)
    reminder_days_before: int = Field(7, ge=0, le=90)
    priority: MaintenancePriority = "Medium"
    status: MaintenanceStatus = "Scheduled"
    assigned_engineer_id: Optional[int] = None
    assigned_engineer_name: Optional[str] = Field(None, max_length=120)
    notes: Optional[str] = None


class MaintenanceUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=3, max_length=180)
    maintenance_type: Optional[MaintenanceType] = None
    scheduled_date: Optional[date] = None
    frequency_days: Optional[int] = Field(None, ge=0, le=1825)
    reminder_days_before: Optional[int] = Field(None, ge=0, le=90)
    priority: Optional[MaintenancePriority] = None
    status: Optional[MaintenanceStatus] = None
    assigned_engineer_id: Optional[int] = None
    assigned_engineer_name: Optional[str] = Field(None, max_length=120)
    notes: Optional[str] = None
    auto_schedule_next: bool = True
    set_device_operational: bool = True


class MaintenanceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    device_id: int
    device_code: str = ""
    device_name: str = ""
    device_location: str = ""
    title: str
    maintenance_type: str
    scheduled_date: date
    frequency_days: int
    reminder_days_before: int
    priority: str
    status: str
    effective_status: str = ""
    is_overdue: bool = False
    is_due_soon: bool = False
    days_until_due: int = 0
    assigned_engineer_id: Optional[int] = None
    assigned_engineer_name: Optional[str] = None
    notes: Optional[str] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


# ---------- Service History Schemas ----------

class ServiceCreate(BaseModel):
    device_id: int
    service_type: ServiceType = "Corrective Repair"
    service_date: date
    fault_description: str = Field(..., min_length=3)
    repair_details: str = Field(..., min_length=3)
    severity: SeverityLevel = "Major"
    outcome: ServiceOutcome = "Resolved"
    cost: float = Field(0.0, ge=0.0)
    engineer_id: Optional[int] = None
    engineer_name: Optional[str] = Field(None, max_length=120)
    parts_replaced: Optional[str] = Field(None, max_length=250)


class ServiceUpdate(BaseModel):
    service_type: Optional[ServiceType] = None
    service_date: Optional[date] = None
    fault_description: Optional[str] = Field(None, min_length=3)
    repair_details: Optional[str] = Field(None, min_length=3)
    severity: Optional[SeverityLevel] = None
    outcome: Optional[ServiceOutcome] = None
    cost: Optional[float] = Field(None, ge=0.0)
    engineer_name: Optional[str] = Field(None, max_length=120)
    parts_replaced: Optional[str] = Field(None, max_length=250)


class ServiceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    device_id: int
    device_code: str = ""
    device_name: str = ""
    device_location: str = ""
    service_type: str
    service_date: date
    fault_description: str
    repair_details: str
    severity: str
    outcome: str
    cost: float
    engineer_id: Optional[int] = None
    engineer_name: str
    parts_replaced: Optional[str] = None
    created_at: datetime


# ---------- Downtime Schemas ----------

class DowntimeCreate(BaseModel):
    device_id: int
    unavailable_at: datetime
    recovery_at: Optional[datetime] = None
    reason: str = Field(..., min_length=3)
    impact_level: ImpactLevel = "High"
    notes: Optional[str] = None
    update_device_status: bool = True

    @field_validator("recovery_at")
    @classmethod
    def check_recovery_after_unavailable(cls, v: Optional[datetime], info):
        unavail = info.data.get("unavailable_at")
        if v is not None and unavail is not None and v <= unavail:
            raise ValueError("Recovery time must be strictly after unavailable time.")
        return v


class DowntimeUpdate(BaseModel):
    unavailable_at: Optional[datetime] = None
    recovery_at: Optional[datetime] = None
    reason: Optional[str] = Field(None, min_length=3)
    impact_level: Optional[ImpactLevel] = None
    notes: Optional[str] = None
    restore_device_operational: bool = True


class DowntimeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    device_id: int
    device_code: str = ""
    device_name: str = ""
    device_location: str = ""
    unavailable_at: datetime
    recovery_at: Optional[datetime] = None
    downtime_minutes: int
    is_ongoing: bool
    reason: str
    impact_level: str
    reported_by_id: Optional[int] = None
    reported_by_name: str
    notes: Optional[str] = None
    created_at: datetime
