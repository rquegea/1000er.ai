from datetime import datetime
from pydantic import BaseModel, EmailStr

from app.models.vision import DetectedProduct, AnalysisSummary


# ── Users ──────────────────────────────────────────────────


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    role: str = "gpv"
    first_name: str | None = None
    last_name: str | None = None
    phone: str | None = None


class UserUpdate(BaseModel):
    email: EmailStr | None = None
    role: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    phone: str | None = None


class UserOut(BaseModel):
    id: str
    tenant_id: str
    email: str
    role: str
    first_name: str | None = None
    last_name: str | None = None
    phone: str | None = None
    created_at: str


class UserListOut(BaseModel):
    data: list[UserOut]
    total: int
    limit: int
    offset: int


# ── Stores ─────────────────────────────────────────────────


class StoreCreate(BaseModel):
    name: str
    address: str | None = None
    chain: str | None = None
    responsible_user_id: str | None = None
    key_account_id: str | None = None
    contact_name: str | None = None
    phone_section_manager: str | None = None
    email_section_manager: str | None = None
    phone_sector_manager: str | None = None
    email_sector_manager: str | None = None
    region: str | None = None
    area: str | None = None
    latitude: float | None = None
    longitude: float | None = None


class StoreUpdate(BaseModel):
    name: str | None = None
    address: str | None = None
    chain: str | None = None
    responsible_user_id: str | None = None
    key_account_id: str | None = None
    contact_name: str | None = None
    phone_section_manager: str | None = None
    email_section_manager: str | None = None
    phone_sector_manager: str | None = None
    email_sector_manager: str | None = None
    region: str | None = None
    area: str | None = None
    latitude: float | None = None
    longitude: float | None = None


class StoreOut(BaseModel):
    id: str
    tenant_id: str
    name: str
    address: str | None = None
    chain: str | None = None
    responsible_user_id: str | None = None
    key_account_id: str | None = None
    contact_name: str | None = None
    phone_section_manager: str | None = None
    email_section_manager: str | None = None
    phone_sector_manager: str | None = None
    email_sector_manager: str | None = None
    region: str | None = None
    area: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    created_at: str


class StoreListOut(BaseModel):
    data: list[StoreOut]
    total: int
    limit: int
    offset: int


# ── Shelf Uploads & Analyses ──────────────────────────────


class ShelfUploadOut(BaseModel):
    id: str
    tenant_id: str
    store_id: str
    image_url: str
    uploaded_by: str
    created_at: str


class AnalysisOut(BaseModel):
    id: str
    tenant_id: str
    shelf_upload_id: str
    status: str
    created_at: str


class DetectedProductOut(BaseModel):
    id: str
    product_name: str
    brand: str | None
    facings: int
    price: float | None
    position_x: float | None
    position_y: float | None
    is_oos: bool
    confidence: float | None


class AnalysisDetailOut(BaseModel):
    id: str
    tenant_id: str
    shelf_upload_id: str
    status: str
    created_at: str
    summary: AnalysisSummary | None = None
    products: list[DetectedProductOut] = []


class AnalysisUploadOut(BaseModel):
    upload: ShelfUploadOut
    analysis: AnalysisDetailOut


class AnalysisListOut(BaseModel):
    data: list[AnalysisOut]
    total: int
    limit: int
    offset: int


# ── Visits ──────────────────────────────────────────────────


class VisitOut(BaseModel):
    id: str
    tenant_id: str
    store_id: str
    user_id: str
    scheduled_at: str | None = None
    started_at: str | None = None
    ended_at: str | None = None
    duration_minutes: int | None = None
    status: str
    notes: str | None = None
    created_at: str


class VisitListOut(BaseModel):
    data: list[VisitOut]
    total: int
    limit: int
    offset: int
