"""Shelf image analysis — V5 YOLOv8 + Gemini hybrid pipeline.

Pass 1: YOLOv8 (foduucom/shelf-object-detection-yolov8) detects bounding boxes.
        Falls back to V4 Gemini detection if YOLO is unavailable.
Post-processing: Same filter/dedup/cap pipeline as V4.
Pass 2: Gemini classifies products given the YOLO bounding boxes.

Final output is the same VisionAnalysisResult as V1/V3/V4 for API compatibility.
"""

import json
import base64
import logging
from typing import TypeVar

import httpx
from pydantic import BaseModel
from google import genai
from google.genai import types

from app.config import settings
from app.models.vision import (
    AnalysisSummary,
    DetectedProduct,
    VisionAnalysisResult,
)
from app.services.validation import validate_analysis
from app.services.shelf_splitter import split_image, adjust_boxes_to_global

# Re-use V4 post-processing and classification helpers
from app.services.vision_v4 import (
    Detection,
    ClassificationResultV4,
    _filter_detections,
    _deduplicate_depth,
    _cap_per_shelf_level,
    _process_detections,
    _remove_overlap_duplicates,
    _classify_products,
    _merge_results,
    _get_client,
    _call_gemini,
    _call_and_parse,
    _parse_json,
    CLASSIFY_PROMPT_TEMPLATE,
    RETRY_PROMPT,
)

logger = logging.getLogger("vision_v5")

T = TypeVar("T", bound=BaseModel)


# ── Pass 1: YOLO bounding box detection ──────────────────────────────────


def _yolo_detect_strip(
    image_bytes: bytes,
) -> list[Detection]:
    """Run YOLO on a single image/strip and return V4 Detection objects."""
    from app.services.yolo_detector import detect_products as yolo_detect

    raw = yolo_detect(
        image_bytes,
        confidence=settings.yolo_confidence,
        iou_threshold=settings.yolo_iou_threshold,
        max_detections=settings.yolo_max_detections,
    )
    return [
        Detection(box_2d=d["box_normalized"], label="product")
        for d in raw
    ]


async def _detect_facings_yolo(
    image_bytes: bytes, mime_type: str
) -> list[Detection]:
    """Pass 1: Use YOLO to detect facings, with shelf splitting for tall images.

    Falls back to Gemini V4 detection if YOLO raises any error.
    """
    try:
        strips = split_image(image_bytes, mime_type)

        if len(strips) == 1:
            return _yolo_detect_strip(image_bytes)

        logger.info("V5 shelf splitting: %d strips", len(strips))
        all_detections: list[Detection] = []

        for i, strip in enumerate(strips):
            strip_dets = _yolo_detect_strip(strip.image_bytes)
            logger.info(
                "V5 Strip %d/%d: %d detections (y=%.2f–%.2f)",
                i + 1, len(strips), len(strip_dets), strip.y_start, strip.y_end,
            )
            adjusted = adjust_boxes_to_global([d.box_2d for d in strip_dets], strip)
            for det, new_box in zip(strip_dets, adjusted):
                det.box_2d = new_box
            all_detections.extend(strip_dets)

        merged = _remove_overlap_duplicates(all_detections)
        logger.info(
            "V5 Merged strips: %d total → %d after overlap dedup",
            len(all_detections), len(merged),
        )
        return merged

    except Exception as exc:
        logger.warning(
            "V5 YOLO detection failed (%s), falling back to V4 Gemini detection",
            exc,
        )
        # Lazy import to avoid circular dep at module load time
        from app.services.vision_v4 import _detect_facings as v4_detect_facings

        client = _get_client()
        return await v4_detect_facings(client, image_bytes, mime_type)


# ── Core analysis ────────────────────────────────────────────────────────


async def _analyze(
    image_bytes: bytes, mime_type: str
) -> tuple[VisionAnalysisResult, list[dict]]:
    """YOLO detection → filter/dedup → Gemini classify → merge → validate."""
    client = _get_client()
    image_part = types.Part.from_bytes(data=image_bytes, mime_type=mime_type)

    # Pass 1: YOLO bounding boxes
    logger.info("V5 Pass 1: Detecting bounding boxes with YOLO...")
    raw_detections = await _detect_facings_yolo(image_bytes, mime_type)
    logger.info("V5 Pass 1 complete: %d raw detections", len(raw_detections))

    # Post-process: filter and deduplicate (same as V4)
    detections = _process_detections(raw_detections)
    logger.info("V5 Post-processing complete: %d final detections", len(detections))

    # Pass 2: Gemini classification (exactly as V4)
    logger.info("V5 Pass 2: Classifying products with Gemini...")
    classification = await _classify_products(client, image_part, detections)
    logger.info(
        "V5 Pass 2 complete: %d products identified",
        len(classification.products),
    )

    # Merge and validate
    result = _merge_results(detections, classification)
    # Patch reasoning prefix to reflect V5
    result.reasoning = result.reasoning.replace("[V4 Detection]", "[V5 YOLO Detection]")
    result.reasoning = result.reasoning.replace("[V4 Classification]", "[V5 Classification]")

    validation = validate_analysis(result)
    if validation.warnings:
        logger.warning("V5 Validation warnings: %s", validation.warnings)
        result.reasoning += "\n\n[V5 Validation] " + "; ".join(validation.warnings)

    # Map product names back to individual detections via detection_indices
    detection_labels: dict[int, str] = {}
    for cp in classification.products:
        for idx in cp.detection_indices:
            detection_labels[idx] = cp.product_name

    raw_detections_data = [
        {"box_2d": d.box_2d, "label": detection_labels.get(i, d.label)}
        for i, d in enumerate(detections)
    ]

    return result, raw_detections_data


# ── Public API ────────────────────────────────────────────────────────────


async def analyze_shelf_image_from_url(image_url: str) -> VisionAnalysisResult:
    """Download an image from a URL and analyze it."""
    async with httpx.AsyncClient() as http_client:
        resp = await http_client.get(image_url, follow_redirects=True, timeout=30)
        resp.raise_for_status()

    content_type = resp.headers.get("content-type", "image/jpeg").split(";")[0]
    result, _ = await _analyze(resp.content, content_type)
    return result


async def analyze_shelf_image_from_bytes(
    image_bytes: bytes, mime_type: str = "image/jpeg"
) -> VisionAnalysisResult:
    """Analyze a shelf image from raw bytes."""
    result, _ = await _analyze(image_bytes, mime_type)
    return result


async def analyze_shelf_image_from_base64(
    b64_data: str, mime_type: str = "image/jpeg"
) -> VisionAnalysisResult:
    """Analyze a shelf image from a base64-encoded string."""
    image_bytes = base64.b64decode(b64_data)
    result, _ = await _analyze(image_bytes, mime_type)
    return result
