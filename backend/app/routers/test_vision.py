"""Test/debug endpoints for vision pipeline.

No authentication required — internal development tool only.
Do NOT expose these endpoints in production without adding auth.

POST /api/v1/test/yolo-detect  — YOLO + post-processing, no Gemini
POST /api/v1/test/v5-full      — Full V5 pipeline (YOLO + Gemini classify)
"""

import logging
import time

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

logger = logging.getLogger("test_vision")
router = APIRouter(prefix="/api/v1/test", tags=["test"])


# ── Response models ───────────────────────────────────────────────────────────


class ShelfLevelInfo(BaseModel):
    level: int
    y_center: int
    count: int


class DetectionItem(BaseModel):
    index: int
    box_normalized: list[int]   # [y_min, x_min, y_max, x_max] range 0-1000
    confidence: float
    area: int


class YoloDetectResponse(BaseModel):
    raw_count: int
    filtered_count: int
    deduped_count: int
    capped_count: int
    final_count: int
    detections: list[DetectionItem]
    shelf_levels: list[ShelfLevelInfo]
    time_ms: int


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.post("/yolo-detect", response_model=YoloDetectResponse)
async def yolo_detect_only(
    file: UploadFile = File(...),
    confidence: float = Form(default=0.25),
    iou_threshold: float = Form(default=0.45),
):
    """Run YOLO detection + V4 post-processing. No Gemini — free to call."""
    t0 = time.perf_counter()
    image_bytes = await file.read()

    try:
        from app.services.yolo_detector import detect_products as yolo_detect
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    from app.services.vision_v4 import (
        Detection,
        _cap_per_shelf_level,
        _deduplicate_depth,
        _filter_detections,
        _group_by_shelf_level,
    )

    # ── YOLO inference ────────────────────────────────────────────────────────
    try:
        raw_yolo = yolo_detect(
            image_bytes,
            confidence=confidence,
            iou_threshold=iou_threshold,
        )
    except Exception as exc:
        logger.exception("YOLO inference failed")
        raise HTTPException(status_code=500, detail=f"YOLO error: {exc}")

    # Convert to Detection objects, preserve YOLO metadata via Python object id
    raw_detections = [
        Detection(box_2d=d["box_normalized"], label="product")
        for d in raw_yolo
    ]
    meta_by_id = {id(det): raw_yolo[i] for i, det in enumerate(raw_detections)}

    # ── Post-processing (same pipeline as V4/V5) ──────────────────────────────
    filtered = _filter_detections(raw_detections)
    deduped = _deduplicate_depth(filtered)
    capped = _cap_per_shelf_level(deduped)

    elapsed_ms = int((time.perf_counter() - t0) * 1000)

    # ── Shelf level grouping ──────────────────────────────────────────────────
    level_groups = _group_by_shelf_level(capped)
    shelf_levels = [
        ShelfLevelInfo(
            level=i + 1,
            y_center=int(
                sum((d.box_2d[0] + d.box_2d[2]) / 2 for d in grp) / len(grp)
            ),
            count=len(grp),
        )
        for i, grp in enumerate(level_groups)
    ]

    # ── Build response detections with original confidence/area ──────────────
    det_items = [
        DetectionItem(
            index=idx,
            box_normalized=det.box_2d,
            confidence=meta_by_id.get(id(det), {}).get("confidence", 0.0),
            area=meta_by_id.get(id(det), {}).get("area", 0),
        )
        for idx, det in enumerate(capped)
    ]

    return YoloDetectResponse(
        raw_count=len(raw_yolo),
        filtered_count=len(filtered),
        deduped_count=len(deduped),
        capped_count=len(capped),
        final_count=len(capped),
        detections=det_items,
        shelf_levels=shelf_levels,
        time_ms=elapsed_ms,
    )


@router.post("/v5-full")
async def v5_full_pipeline(
    file: UploadFile = File(...),
):
    """Run full V5 pipeline: YOLO detection + Gemini classification.

    Uses VISION_PIPELINE=v5. Make sure the env var is set before calling this.
    """
    t0 = time.perf_counter()
    image_bytes = await file.read()
    mime_type = file.content_type or "image/jpeg"

    try:
        from app.services.vision_v5 import _analyze as v5_analyze
    except ImportError as exc:
        raise HTTPException(status_code=503, detail=f"V5 not available: {exc}")

    try:
        result, raw_detections = await v5_analyze(image_bytes, mime_type)
    except Exception as exc:
        logger.exception("V5 pipeline failed")
        raise HTTPException(status_code=500, detail=str(exc))

    elapsed_ms = int((time.perf_counter() - t0) * 1000)

    return {
        "detections": [
            {
                "index": i,
                "box_normalized": d["box_2d"],
                "label": d.get("label", ""),
            }
            for i, d in enumerate(raw_detections)
        ],
        "products": [
            {
                "product_name": p.product_name,
                "brand": p.brand,
                "facings": p.facings,
                "price": p.price,
                "currency": p.currency,
                "confidence": p.confidence,
                "is_oos": p.is_oos,
                "position_x": p.position_x,
                "position_y": p.position_y,
            }
            for p in result.products
        ],
        "summary": result.summary.model_dump(),
        "reasoning": result.reasoning,
        "time_ms": elapsed_ms,
    }
