"""Vision pipeline router — selects V1, V3 or V4 based on config."""

from app.config import settings
from app.models.vision import VisionAnalysisResult


def _get_pipeline():
    if settings.vision_pipeline == "v5":
        from app.services import vision_v5
        return vision_v5
    if settings.vision_pipeline == "v4":
        from app.services import vision_v4
        return vision_v4
    if settings.vision_pipeline == "v3":
        from app.services import vision_v3
        return vision_v3
    from app.services import vision
    return vision


async def analyze_shelf_image_from_url(image_url: str) -> VisionAnalysisResult:
    return await _get_pipeline().analyze_shelf_image_from_url(image_url)


async def analyze_shelf_image_from_bytes(
    image_bytes: bytes, mime_type: str = "image/jpeg"
) -> VisionAnalysisResult:
    return await _get_pipeline().analyze_shelf_image_from_bytes(image_bytes, mime_type)


async def analyze_shelf_image_from_base64(
    b64_data: str, mime_type: str = "image/jpeg"
) -> VisionAnalysisResult:
    return await _get_pipeline().analyze_shelf_image_from_base64(b64_data, mime_type)
