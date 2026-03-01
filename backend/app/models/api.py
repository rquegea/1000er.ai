from datetime import datetime
from pydantic import BaseModel

from app.models.vision import DetectedProduct, AnalysisSummary


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


# ── Chains ──────────────────────────────────────────────────


class ChainOut(BaseModel):
    id: str
    tenant_id: str
    name: str
    logo_url: str | None = None
    website: str | None = None
    country: str | None = None
    created_at: str


class ChainListOut(BaseModel):
    data: list[ChainOut]
    total: int
    limit: int
    offset: int


# ── Brands ──────────────────────────────────────────────────


class BrandOut(BaseModel):
    id: str
    tenant_id: str
    name: str
    logo_url: str | None = None
    is_own: bool
    category: str | None = None
    created_at: str


class BrandListOut(BaseModel):
    data: list[BrandOut]
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
    completed_at: str | None = None
    duration_minutes: int | None = None
    status: str
    notes: str | None = None
    created_at: str


class VisitListOut(BaseModel):
    data: list[VisitOut]
    total: int
    limit: int
    offset: int
