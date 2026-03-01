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
