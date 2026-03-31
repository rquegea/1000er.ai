"""Shelf image analysis — V4 bounding-box detection pipeline.

Pass 1: Gemini native box_2d detection to locate every front-row facing.
Post-processing: Filter invalid boxes, deduplicate depth via IoU.
Pass 2: Classify products given real bounding boxes.

Final output is the same VisionAnalysisResult as V1/V3 for API compatibility.
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

logger = logging.getLogger("vision_v4")

T = TypeVar("T", bound=BaseModel)

# ── Prompts ───────────────────────────────────────────────────────────────

DETECTION_PROMPT = """Detect the 2D bounding boxes of every individual product unit visible at the FRONT EDGE of this retail shelf.

CRITICAL RULES:
- Each bounding box = ONE product PACKAGE/UNIT (one facing)
- ONLY detect products at the VERY FRONT of the shelf, closest to the camera
- Products BEHIND the front row (depth/stock) must NOT be detected
- If you see identical products in a line going AWAY from the camera (one behind another), only box the FRONT one
- Each box should tightly wrap ONE product package/unit
- Include ALL products across ALL shelf levels

PACKAGING TYPE RULE — very important for snack/cracker/tortita shelves:
- A BAG of tortitas, crackers, galletas, chips = 1 facing. Box the ENTIRE BAG as one unit.
- Do NOT box the individual rounds, discs or items visible INSIDE the bag through transparent packaging.
- A transparent bag showing 8 tortita discs stacked = still 1 facing, 1 bounding box for the whole bag.
- Round bags (Bicentury, etc.), tall bags (Gullón Vitalday, etc.), cylinders (Ecocesta, etc.) — each PACKAGE = 1 box.

Output a JSON list where each entry contains:
- "box_2d": bounding box as [y_min, x_min, y_max, x_max] in range [0, 1000]
- "label": brief visual description of the product package (e.g. "blue tortita bag", "tall green vitalday bag", "red cracker box")

IMPORTANT: Do NOT use "label" to identify the product name — just describe what you see visually. Product identification comes later."""

CLASSIFY_PROMPT_TEMPLATE = """I have detected {n} individual product facings on this shelf image.
Here are their bounding box positions (normalized 0-1000, format [y_min, x_min, y_max, x_max]):

{detections_json}

For each detection, identify:
1. The product name (read from packaging, in the language shown — do NOT translate)
2. The brand
3. The price (if a shelf price label is visible near this product)
4. The currency from the label format (€, $, £)
5. Your confidence (0.0-1.0)

Then GROUP detections of the same product and return the final product list.

Respond with ONLY a JSON object (no markdown, no explanation):
{{
  "reasoning": "Detection 0-2 are Brand X Product Y... Detection 3-4 are...",
  "products": [
    {{
      "product_name": "Full Product Name Including Variant",
      "brand": "Brand Name",
      "detection_indices": [0, 1, 2],
      "facings": 3,
      "price": 1.55,
      "currency": "EUR",
      "position_x": 0.15,
      "position_y": 0.12,
      "is_oos": false,
      "confidence": 0.92
    }}
  ]
}}

PRODUCT NAME RULES — CRITICAL:
- The product name is the MARKETING NAME on the front of the package, NOT weight, gramaje, nutritional claims, or barcodes.
- IGNORE numbers like "83", "78", "65", "500g", "375g" — these are package weights, not product names.
- IGNORE percentage claims like "23% protein", "0% sugar" — these are nutritional claims, not product names.
- IGNORE price numbers from shelf labels — these go in the "price" field, not the product name.
- Example: A box showing "Special K" with "83" and "65 calorias" → product_name should be "Special K Original", NOT "Special K 83".
- Example: A box showing "HIGH PROTEIN 23%" → product_name should be "Special K High Protein", NOT "Special K High Protein 23%".
- When you see a brand logo (e.g. large "K" for Kellogg's), use the actual product line name, not just the letter.

{catalog_section}

RULES:
- The sum of all product facings MUST equal {n}. Do not add or remove facings.
- Each detection index must appear in exactly one product's detection_indices.
- Confidence: 0.9+ if name clearly readable, 0.7-0.9 if partially readable, 0.5-0.7 if guessing.
- Position: use the average center of the product's detection boxes (normalize to 0.0-1.0 by dividing by 1000).
- If two groups are the same product but at different prices, list as separate entries only if packaging is visibly different. Otherwise merge and use the most visible price.
- VARIANT DIFFERENTIATION: When a brand (e.g. Bicentury, Gullón Vitalday, Ecocesta) has multiple similar-looking SKUs, look for the specific variant text on each package (e.g. "Maíz", "Avena", "Chocolate", "Arroz Quinoa"). Different variant text = different product = separate entries. Do NOT merge all similar packages from the same brand into one entry.

You MUST respond with ONLY a raw JSON object. No markdown fences, no text before or after."""

RETRY_PROMPT = """Your previous response was not valid JSON. You MUST respond with ONLY a raw JSON object. No markdown fences, no explanation, no text before or after. Just the JSON object starting with { and ending with }."""

# ── Pydantic models for V4 intermediate results ──────────────────────────


class Detection(BaseModel):
    box_2d: list[int]
    label: str = ""


class ClassifiedProductV4(BaseModel):
    product_name: str
    brand: str | None = None
    detection_indices: list[int] = []
    facings: int
    price: float | None = None
    currency: str | None = None
    position_x: float
    position_y: float
    is_oos: bool = False
    confidence: float


class ClassificationResultV4(BaseModel):
    reasoning: str = ""
    products: list[ClassifiedProductV4] = []


# ── Helpers ───────────────────────────────────────────────────────────────


def _get_client() -> genai.Client:
    return genai.Client(api_key=settings.gemini_api_key)


def _parse_json(text: str, model_class: type[T]) -> T:
    """Strip markdown fences from Gemini response and validate with Pydantic."""
    cleaned = text.strip()
    while cleaned.startswith("```"):
        first_newline = cleaned.index("\n")
        cleaned = cleaned[first_newline + 1 :]
    if cleaned.endswith("```"):
        cleaned = cleaned[: cleaned.rfind("```")]
    cleaned = cleaned.strip()
    return model_class.model_validate_json(cleaned)


def _call_gemini(
    client: genai.Client,
    model: str,
    contents: list,
    temperature: float,
    response_mime_type: str | None = None,
    response_schema: dict | None = None,
    thinking_budget: int | None = None,
) -> str:
    """Call Gemini and return the response text."""
    config_kwargs: dict = {"temperature": temperature}
    if response_mime_type:
        config_kwargs["response_mime_type"] = response_mime_type
    if response_schema:
        config_kwargs["response_schema"] = response_schema
    if thinking_budget is not None:
        config_kwargs["thinking_config"] = types.ThinkingConfig(
            thinking_budget=thinking_budget
        )

    config = types.GenerateContentConfig(**config_kwargs)
    response = client.models.generate_content(
        model=model,
        contents=contents,
        config=config,
    )
    return response.text


def _call_and_parse(
    client: genai.Client,
    model: str,
    contents: list,
    temperature: float,
    model_class: type[T],
) -> T:
    """Call Gemini, parse JSON, retry once on failure."""
    text = _call_gemini(client, model, contents, temperature)
    try:
        return _parse_json(text, model_class)
    except (json.JSONDecodeError, ValueError):
        pass

    retry_text = _call_gemini(
        client,
        model,
        contents + [RETRY_PROMPT],
        temperature,
    )
    try:
        return _parse_json(retry_text, model_class)
    except (json.JSONDecodeError, ValueError) as exc:
        raise RuntimeError(
            f"Gemini returned invalid JSON after retry: {retry_text[:500]}"
        ) from exc


# ── Bounding box utilities ────────────────────────────────────────────────


def _box_area(box: list[int]) -> int:
    """Area of a box in [y_min, x_min, y_max, x_max] format."""
    return (box[2] - box[0]) * (box[3] - box[1])


def _box_height(box: list[int]) -> int:
    return box[2] - box[0]


def _iou(box1: list[int], box2: list[int]) -> float:
    """Intersection over Union for two boxes in [y_min, x_min, y_max, x_max]."""
    y_min = max(box1[0], box2[0])
    x_min = max(box1[1], box2[1])
    y_max = min(box1[2], box2[2])
    x_max = min(box1[3], box2[3])

    if y_min >= y_max or x_min >= x_max:
        return 0.0

    intersection = (y_max - y_min) * (x_max - x_min)
    area1 = _box_area(box1)
    area2 = _box_area(box2)
    union = area1 + area2 - intersection

    return intersection / union if union > 0 else 0.0


def _x_overlap_ratio(box1: list[int], box2: list[int]) -> float:
    """Overlap in X as a fraction of the narrower box's width (0.0–1.0)."""
    x_min = max(box1[1], box2[1])
    x_max = min(box1[3], box2[3])
    if x_min >= x_max:
        return 0.0
    overlap_width = x_max - x_min
    min_width = min(box1[3] - box1[1], box2[3] - box2[1])
    return overlap_width / min_width if min_width > 0 else 0.0


def _deduplicate_depth(
    detections: list[Detection], iou_threshold: float = 0.35
) -> list[Detection]:
    """Remove detections that likely represent depth (product behind the front row).

    Two strategies:
    1. IoU > threshold  — catches heavily overlapping boxes.
    2. Vertical proximity + horizontal overlap — catches front-to-back stacking
       where boxes are in the same column but slightly offset in Y (low IoU).
    """
    if not detections:
        return detections

    # Sort by area descending — larger box is assumed to be the front product
    sorted_dets = sorted(detections, key=lambda d: _box_area(d.box_2d), reverse=True)
    keep: list[Detection] = []

    for det in sorted_dets:
        det_area = _box_area(det.box_2d)
        det_cy = (det.box_2d[0] + det.box_2d[2]) / 2
        is_duplicate = False

        for kept in keep:
            # Strategy 1: IoU threshold (lowered to 0.35)
            if _iou(det.box_2d, kept.box_2d) > iou_threshold:
                is_duplicate = True
                break

            # Strategy 2: Vertical proximity + horizontal overlap
            x_overlap = _x_overlap_ratio(det.box_2d, kept.box_2d)
            if x_overlap > 0.45:
                kept_cy = (kept.box_2d[0] + kept.box_2d[2]) / 2
                max_h = max(_box_height(det.box_2d), _box_height(kept.box_2d))
                y_distance = abs(det_cy - kept_cy)
                if y_distance < max_h * 1.2:
                    kept_area = _box_area(kept.box_2d)
                    area_ratio = det_area / kept_area if kept_area > 0 else 1.0
                    if area_ratio < 0.85:
                        is_duplicate = True
                        break

        if not is_duplicate:
            keep.append(det)

    return keep


def _group_by_shelf_level(
    detections: list[Detection], y_tolerance: float = 80
) -> list[list[Detection]]:
    """Group detections into shelf levels by Y center proximity."""
    if not detections:
        return []
    sorted_dets = sorted(detections, key=lambda d: (d.box_2d[0] + d.box_2d[2]) / 2)
    levels: list[list[Detection]] = []
    current_level: list[Detection] = [sorted_dets[0]]
    current_y = (sorted_dets[0].box_2d[0] + sorted_dets[0].box_2d[2]) / 2

    for det in sorted_dets[1:]:
        det_y = (det.box_2d[0] + det.box_2d[2]) / 2
        if abs(det_y - current_y) <= y_tolerance:
            current_level.append(det)
        else:
            levels.append(current_level)
            current_level = [det]
            current_y = det_y

    levels.append(current_level)
    return levels


def _cap_per_shelf_level(
    detections: list[Detection], max_per_level: int = 12
) -> list[Detection]:
    """Safety net: if a shelf level has too many detections, keep only the largest."""
    levels = _group_by_shelf_level(detections)
    result: list[Detection] = []
    for level in levels:
        if len(level) <= max_per_level:
            result.extend(level)
        else:
            level_sorted = sorted(level, key=lambda d: _box_area(d.box_2d), reverse=True)
            result.extend(level_sorted[:max_per_level])
            logger.warning(
                "Shelf level cap: %d → %d detections (removed %d likely depth)",
                len(level), max_per_level, len(level) - max_per_level,
            )
    return result


def _filter_detections(detections: list[Detection]) -> list[Detection]:
    """Filter out invalid bounding boxes."""
    cleaned: list[Detection] = []
    for det in detections:
        box = det.box_2d
        if len(box) != 4:
            continue

        y_min, x_min, y_max, x_max = box

        # Must have valid ordering
        if y_min >= y_max or x_min >= x_max:
            continue

        # Must be within bounds (allow small overflow)
        if any(c < -10 or c > 1010 for c in box):
            continue

        # Clamp to valid range
        det.box_2d = [
            max(0, min(1000, y_min)),
            max(0, min(1000, x_min)),
            max(0, min(1000, y_max)),
            max(0, min(1000, x_max)),
        ]

        # Minimum area: at least 0.1% of image (1000 in 1000x1000 space)
        if _box_area(det.box_2d) < 1000:
            continue

        cleaned.append(det)

    return cleaned


def _process_detections(
    raw_detections: list[Detection],
) -> list[Detection]:
    """Filter invalid boxes → depth dedup → per-level cap."""
    filtered = _filter_detections(raw_detections)
    logger.info(
        "V4 Detection: %d raw → %d after filtering",
        len(raw_detections),
        len(filtered),
    )

    deduped = _deduplicate_depth(filtered)
    logger.info(
        "V4 Detection: %d after filtering → %d after depth dedup",
        len(filtered),
        len(deduped),
    )

    capped = _cap_per_shelf_level(deduped)
    logger.info(
        "V4 Detection: %d after depth dedup → %d after shelf-level cap",
        len(deduped),
        len(capped),
    )

    return capped


# ── Strip-level detection helpers ────────────────────────────────────────


def _remove_overlap_duplicates(
    detections: list[Detection], iou_threshold: float = 0.4
) -> list[Detection]:
    """After merging multi-strip detections, remove boxes that duplicate a detection
    from the overlapping region of an adjacent strip."""
    return _deduplicate_depth(detections, iou_threshold)


# ── Pass 1: Bounding box detection ───────────────────────────────────────


_DETECTION_SCHEMA = {
    "type": "ARRAY",
    "items": {
        "type": "OBJECT",
        "properties": {
            "box_2d": {
                "type": "ARRAY",
                "items": {"type": "INTEGER"},
                "minItems": 4,
                "maxItems": 4,
                "description": "Bounding box [y_min, x_min, y_max, x_max] in range [0, 1000]",
            },
            "label": {
                "type": "STRING",
                "description": "Visual description of the product",
            },
        },
        "required": ["box_2d", "label"],
    },
}


async def _detect_facings_single(
    client: genai.Client, image_part: types.Part
) -> list[Detection]:
    """Detect facings in a single image part (used per-strip)."""
    raw_text = _call_gemini(
        client,
        settings.gemini_count_model,
        [image_part, DETECTION_PROMPT],
        temperature=settings.gemini_detection_temperature,
        response_mime_type="application/json",
        response_schema=_DETECTION_SCHEMA,
        thinking_budget=0,
    )

    try:
        raw_list = json.loads(raw_text)
    except json.JSONDecodeError as exc:
        raise RuntimeError(
            f"Gemini detection returned invalid JSON: {raw_text[:500]}"
        ) from exc

    return [Detection.model_validate(item) for item in raw_list]


async def _detect_facings(
    client: genai.Client, image_bytes: bytes, mime_type: str
) -> list[Detection]:
    """Pass 1: Split image into strips and detect facings per strip.

    For small/landscape images a single pass is used. For tall portrait
    images (typical shelf photos) each strip is analysed independently and
    bounding boxes are adjusted back to global coordinates before merging.
    """
    strips = split_image(image_bytes, mime_type)

    if len(strips) == 1:
        # No split needed — run single pass on the full image
        image_part = types.Part.from_bytes(data=image_bytes, mime_type=mime_type)
        return await _detect_facings_single(client, image_part)

    logger.info("V4 shelf splitting: %d strips", len(strips))
    all_detections: list[Detection] = []

    for i, strip in enumerate(strips):
        strip_part = types.Part.from_bytes(data=strip.image_bytes, mime_type=strip.mime_type)
        strip_dets = await _detect_facings_single(client, strip_part)
        logger.info("V4 Strip %d/%d: %d detections (y=%.2f–%.2f)",
                    i + 1, len(strips), len(strip_dets), strip.y_start, strip.y_end)

        # Adjust local bounding boxes → global image coordinates
        adjusted = adjust_boxes_to_global([d.box_2d for d in strip_dets], strip)
        for det, new_box in zip(strip_dets, adjusted):
            det.box_2d = new_box
        all_detections.extend(strip_dets)

    # Remove duplicates introduced by strip overlap regions
    merged = _remove_overlap_duplicates(all_detections)
    logger.info("V4 Merged strips: %d total → %d after overlap dedup",
                len(all_detections), len(merged))
    return merged


# ── Pass 2: Classification ───────────────────────────────────────────────


def _build_catalog_section(catalog: list[dict] | None) -> str:
    """Build the catalog prompt section from a list of product dicts."""
    if not catalog:
        return ""
    lines = [f"- {p['name']} ({p.get('brand', 'Unknown')})" for p in catalog]
    return (
        "KNOWN PRODUCTS IN THIS STORE (use these names when you recognize a match):\n"
        + "\n".join(lines)
        + "\n\nWhen a detected product matches a known product, use the EXACT name and brand from this list.\n"
        "Only create a new product name if nothing in the catalog matches what you see."
    )


def _fetch_catalog(tenant_id: str) -> list[dict] | None:
    """Fetch active product catalog for a tenant from the database."""
    from app.deps import get_supabase_client

    try:
        sb = get_supabase_client()
        rows = (
            sb.table("products")
            .select("name, brand")
            .eq("tenant_id", tenant_id)
            .eq("active", True)
            .execute()
        )
        return rows.data if rows.data else None
    except Exception as exc:
        logger.warning("Failed to fetch catalog for tenant %s: %s", tenant_id, exc)
        return None


async def _classify_products(
    client: genai.Client,
    image_part: types.Part,
    detections: list[Detection],
    catalog: list[dict] | None = None,
) -> ClassificationResultV4:
    """Pass 2: Classify products given real bounding boxes."""
    detections_for_prompt = [
        {"index": i, "box_2d": d.box_2d, "label": d.label}
        for i, d in enumerate(detections)
    ]
    detections_json = json.dumps(detections_for_prompt, indent=2)

    catalog_section = _build_catalog_section(catalog)

    prompt = CLASSIFY_PROMPT_TEMPLATE.format(
        n=len(detections),
        detections_json=detections_json,
        catalog_section=catalog_section,
    )

    return _call_and_parse(
        client,
        settings.gemini_classify_model,
        [image_part, prompt],
        settings.gemini_classify_temperature,
        ClassificationResultV4,
    )


# ── Merge into standard result ───────────────────────────────────────────


def _merge_results(
    detections: list[Detection],
    classification: ClassificationResultV4,
) -> VisionAnalysisResult:
    """Convert V4 intermediate models to the standard VisionAnalysisResult."""
    products: list[DetectedProduct] = []

    for cp in classification.products:
        # Normalize position from 0-1000 to 0.0-1.0, clamping to valid range
        pos_x = max(0.0, min(1.0, cp.position_x))
        pos_y = max(0.0, min(1.0, cp.position_y))

        products.append(
            DetectedProduct(
                product_name=cp.product_name,
                brand=cp.brand,
                facings=cp.facings,
                price=cp.price,
                currency=cp.currency,
                position_x=pos_x,
                position_y=pos_y,
                is_oos=cp.is_oos,
                is_partial=False,
                confidence=cp.confidence,
            )
        )

    non_oos = [p for p in products if not p.is_oos]
    total_facings = sum(p.facings for p in non_oos)
    total_products = len(products)
    oos_count = sum(1 for p in products if p.is_oos)
    confidences = [p.confidence for p in products if p.confidence is not None]
    avg_confidence = (sum(confidences) / len(confidences)) if confidences else 0.0

    combined_reasoning = (
        f"[V4 Detection] {len(detections)} bounding boxes detected, "
        f"{total_facings} facings after filtering/dedup\n\n"
        f"[V4 Classification] {classification.reasoning}"
    )

    return VisionAnalysisResult(
        reasoning=combined_reasoning,
        products=products,
        summary=AnalysisSummary(
            total_products=total_products,
            total_facings=total_facings,
            oos_count=oos_count,
            avg_confidence=round(avg_confidence, 2),
        ),
    )


# ── Core analysis ────────────────────────────────────────────────────────


async def _analyze(
    image_bytes: bytes, mime_type: str, tenant_id: str | None = None
) -> tuple[VisionAnalysisResult, list[dict]]:
    """Bbox detection → filter/dedup → classify → merge → validate.

    Returns (result, raw_detections_for_storage).
    """
    client = _get_client()
    image_part = types.Part.from_bytes(data=image_bytes, mime_type=mime_type)

    # Fetch catalog for tenant (if available)
    catalog = _fetch_catalog(tenant_id) if tenant_id else None
    if catalog:
        logger.info("V4 Catalog: %d products loaded for tenant %s", len(catalog), tenant_id)

    # Pass 1: Detect bounding boxes (with automatic shelf splitting)
    logger.info("V4 Pass 1: Detecting bounding boxes...")
    raw_detections = await _detect_facings(client, image_bytes, mime_type)
    logger.info("V4 Pass 1 complete: %d raw detections", len(raw_detections))

    # Post-process: filter and deduplicate
    detections = _process_detections(raw_detections)
    logger.info("V4 Post-processing complete: %d final detections", len(detections))

    # Pass 2: Classify products
    logger.info("V4 Pass 2: Classifying products...")
    classification = await _classify_products(client, image_part, detections, catalog=catalog)
    logger.info(
        "V4 Pass 2 complete: %d products identified",
        len(classification.products),
    )

    # Merge and validate
    result = _merge_results(detections, classification)

    validation = validate_analysis(result)
    if validation.warnings:
        logger.warning("V4 Validation warnings: %s", validation.warnings)
        result.reasoning += "\n\n[V4 Validation] " + "; ".join(validation.warnings)

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


async def analyze_shelf_image_from_url(
    image_url: str, tenant_id: str | None = None
) -> VisionAnalysisResult:
    """Download an image from a URL and analyze it."""
    async with httpx.AsyncClient() as http_client:
        resp = await http_client.get(image_url, follow_redirects=True, timeout=30)
        resp.raise_for_status()

    content_type = resp.headers.get("content-type", "image/jpeg").split(";")[0]
    result, _ = await _analyze(resp.content, content_type, tenant_id=tenant_id)
    return result


async def analyze_shelf_image_from_bytes(
    image_bytes: bytes, mime_type: str = "image/jpeg", tenant_id: str | None = None
) -> VisionAnalysisResult:
    """Analyze a shelf image from raw bytes."""
    result, _ = await _analyze(image_bytes, mime_type, tenant_id=tenant_id)
    return result


async def analyze_shelf_image_from_base64(
    b64_data: str, mime_type: str = "image/jpeg", tenant_id: str | None = None
) -> VisionAnalysisResult:
    """Analyze a shelf image from a base64-encoded string."""
    image_bytes = base64.b64decode(b64_data)
    result, _ = await _analyze(image_bytes, mime_type, tenant_id=tenant_id)
    return result
