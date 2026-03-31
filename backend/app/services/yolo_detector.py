"""YOLO product detector for shelf analysis.

Uses a YOLOv8 model fine-tuned on SKU-110K (single class: "object" = product).
Returns boxes in V4-compatible format: [y_min, x_min, y_max, x_max] normalised
to range 0-1000.

The model is loaded once as a lazy singleton.

Shelf splitting: images are sliced into overlapping horizontal strips so that
products on distant (upper) shelves appear large enough for reliable detection.
Detections from each strip are mapped back to full-image coordinates and
de-duplicated with NMS.
"""

from __future__ import annotations

import io
import logging
from pathlib import Path
from typing import Any

from PIL import Image

logger = logging.getLogger("yolo_detector")

_model: Any = None  # lazy singleton

MODEL_PATH = Path(__file__).resolve().parents[2] / "models" / "best.pt"

# ── Shelf-splitting parameters ────────────────────────────────────────────────

NUM_STRIPS = 4
STRIP_OVERLAP = 0.15


# ── Model loading ──────────────────────────────────────────────────────────────


def _get_model() -> Any:
    """Load YOLOv8 SKU-110K model once and cache it as a singleton."""
    global _model
    if _model is not None:
        return _model

    from ultralytics import YOLO  # type: ignore[import]

    logger.info("YOLO: loading %s ...", MODEL_PATH)
    model = YOLO(str(MODEL_PATH))

    model.overrides["conf"] = 0.10
    model.overrides["iou"] = 0.45
    model.overrides["max_det"] = 300

    _model = model
    logger.info("YOLO: model ready (SKU-110K, single class)")
    return _model


# ── Strip helpers ─────────────────────────────────────────────────────────────


def _compute_strips(height: int) -> list[tuple[int, int]]:
    """Return (y_start, y_end) pixel ranges for overlapping horizontal strips."""
    base_h = height / NUM_STRIPS
    overlap_px = int(base_h * STRIP_OVERLAP)
    strips: list[tuple[int, int]] = []
    for i in range(NUM_STRIPS):
        y_start = max(0, int(i * base_h) - overlap_px)
        y_end = min(height, int((i + 1) * base_h) + overlap_px)
        strips.append((y_start, y_end))
    return strips


def _nms_merge(detections: list[dict], iou_threshold: float = 0.45) -> list[dict]:
    """Remove duplicate boxes that appear in overlapping strips via NMS."""
    if not detections:
        return detections

    dets = sorted(detections, key=lambda d: d["confidence"], reverse=True)
    keep: list[dict] = []

    for det in dets:
        b = det["box"]
        is_dup = False
        for kept in keep:
            kb = kept["box"]
            ix1 = max(b[0], kb[0])
            iy1 = max(b[1], kb[1])
            ix2 = min(b[2], kb[2])
            iy2 = min(b[3], kb[3])
            iw = max(0, ix2 - ix1)
            ih = max(0, iy2 - iy1)
            inter = iw * ih
            area_a = (b[2] - b[0]) * (b[3] - b[1])
            area_b = (kb[2] - kb[0]) * (kb[3] - kb[1])
            union = area_a + area_b - inter
            if union > 0 and inter / union > iou_threshold:
                is_dup = True
                break
        if not is_dup:
            keep.append(det)

    return keep


# ── Inference ─────────────────────────────────────────────────────────────────


def _detect_on_image(
    model: Any,
    img: Image.Image,
    confidence: float,
    iou_threshold: float,
    max_detections: int,
    y_offset: int = 0,
    full_width: int | None = None,
    full_height: int | None = None,
) -> list[dict]:
    """Run YOLO on a single PIL image and return detections."""
    width, height = img.size
    fw = full_width or width
    fh = full_height or height

    results = model.predict(
        img,
        conf=confidence,
        iou=iou_threshold,
        max_det=max_detections,
        verbose=False,
    )

    detections: list[dict] = []
    if not results or results[0].boxes is None:
        return detections

    for box in results[0].boxes:
        x1, y1, x2, y2 = (float(v) for v in box.xyxy[0])
        conf = float(box.conf[0])

        y1_full = y1 + y_offset
        y2_full = y2 + y_offset

        x_min_n = int(round(x1 / fw * 1000))
        y_min_n = int(round(y1_full / fh * 1000))
        x_max_n = int(round(x2 / fw * 1000))
        y_max_n = int(round(y2_full / fh * 1000))

        box_normalized = [
            max(0, min(1000, y_min_n)),
            max(0, min(1000, x_min_n)),
            max(0, min(1000, y_max_n)),
            max(0, min(1000, x_max_n)),
        ]

        area = (box_normalized[2] - box_normalized[0]) * (box_normalized[3] - box_normalized[1])

        detections.append({
            "box": [x1, y1_full, x2, y2_full],
            "box_normalized": box_normalized,
            "confidence": conf,
            "area": area,
        })

    return detections


def detect_products(
    image_bytes: bytes,
    confidence: float = 0.10,
    iou_threshold: float = 0.45,
    max_detections: int = 300,
) -> list[dict]:
    """Run YOLO inference on raw image bytes with shelf splitting.

    Returns a list of dicts, each with:
    - ``box``: raw xyxy box in pixel coordinates (full image)
    - ``box_normalized``: [y_min, x_min, y_max, x_max] in range 0-1000
    - ``confidence``: detection confidence score
    - ``area``: normalised box area in 0-1000 space
    """
    model = _get_model()

    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    width, height = img.size

    # --- Full-image pass ---
    all_detections = _detect_on_image(
        model, img, confidence, iou_threshold, max_detections,
    )
    logger.info("YOLO: full-image pass found %d detections", len(all_detections))

    # --- Strip passes ---
    strips = _compute_strips(height)
    for i, (y_start, y_end) in enumerate(strips):
        strip_img = img.crop((0, y_start, width, y_end))
        strip_dets = _detect_on_image(
            model, strip_img, confidence, iou_threshold, max_detections,
            y_offset=y_start,
            full_width=width,
            full_height=height,
        )
        logger.info(
            "YOLO: strip %d/%d (y=%d-%d) found %d detections",
            i + 1, NUM_STRIPS, y_start, y_end, len(strip_dets),
        )
        all_detections.extend(strip_dets)

    # --- Merge duplicates ---
    merged = _nms_merge(all_detections, iou_threshold=iou_threshold)

    logger.info(
        "YOLO: %d detections after merge on %dx%d image "
        "(from %d raw across %d strips + full)",
        len(merged), width, height, len(all_detections), NUM_STRIPS,
    )
    return merged
