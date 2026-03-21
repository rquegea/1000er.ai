"""Intermediate Pydantic models for the V3 two-pass vision pipeline.

These are internal to the pipeline and not exposed via the API.
The final output is always converted to VisionAnalysisResult.
"""

from pydantic import BaseModel, Field


class FacingPosition(BaseModel):
    id: int
    x: float = Field(ge=0.0, le=1.0)
    y: float = Field(ge=0.0, le=1.0)
    is_partial: bool = False


class OosGap(BaseModel):
    x: float = Field(ge=0.0, le=1.0)
    y: float = Field(ge=0.0, le=1.0)
    width_estimate: float = Field(ge=0.0, le=1.0, default=0.05)
    description: str = ""


class ShelfLevel(BaseModel):
    level: int
    description: str = ""
    y_center: float = Field(ge=0.0, le=1.0)
    facings: list[FacingPosition] = []
    facing_count: int = 0


class CountingResult(BaseModel):
    reasoning: str = ""
    shelf_levels: list[ShelfLevel] = []
    total_facings: int = 0
    oos_gaps: list[OosGap] = []


class ClassifiedProduct(BaseModel):
    product_name: str
    brand: str | None = None
    facing_indices: list[int] = []
    facings: int = Field(ge=0)
    price: float | None = None
    currency: str | None = None
    position_x: float = Field(ge=0.0, le=1.0)
    position_y: float = Field(ge=0.0, le=1.0)
    is_oos: bool = False
    is_partial: bool = False
    confidence: float = Field(ge=0.0, le=1.0)


class ClassificationResult(BaseModel):
    reasoning: str = ""
    products: list[ClassifiedProduct] = []
