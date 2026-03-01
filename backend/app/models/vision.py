from pydantic import BaseModel, Field


class DetectedProduct(BaseModel):
    product_name: str
    brand: str | None = None
    facings: int = Field(ge=0)
    price: float | None = None
    currency: str | None = None
    position_x: float = Field(ge=0.0, le=1.0)
    position_y: float = Field(ge=0.0, le=1.0)
    is_oos: bool = False
    is_partial: bool = False
    confidence: float = Field(ge=0.0, le=1.0)


class AnalysisSummary(BaseModel):
    total_products: int
    total_facings: int
    oos_count: int
    avg_confidence: float


class VisionAnalysisResult(BaseModel):
    reasoning: str
    products: list[DetectedProduct]
    summary: AnalysisSummary
