"""Shelf image analysis — V2 two-phase pipeline with legacy fallback.

V2 pipeline:
  Phase 1: Object detection via HuggingFace (detection.py) → bounding boxes
  Phase 2: Classification via Gemini 2.5 Flash using numbered mosaic (mosaic.py)

Legacy: Single-pass Gemini analysis (original approach, used as fallback).
"""

import json
import base64
import logging
from typing import Any

import httpx
from pydantic import BaseModel, Field
from google import genai
from google.genai import types

from app.config import settings
from app.models.vision import (
    AnalysisSummary,
    DetectedProduct,
    VisionAnalysisResult,
)
from app.services.detection import DetectionError, detect_products
from app.services.mosaic import MosaicResult, generate_mosaics

logger = logging.getLogger("vision")

# ── V2 Classification Prompt ───────────────────────────────────────────────

V2_CLASSIFICATION_PROMPT = """You are an expert retail shelf analyst. You receive:
1. The ORIGINAL shelf photo (full shelf view).
2. One or more NUMBERED MOSAIC grids. Each mosaic is a grid of individually cropped product images detected by an object detector. Every crop has a visible number (#1, #2, #3, …) in its top-left corner.

Each crop in the mosaic represents exactly ONE facing detected on the shelf.

YOUR TASK: Identify the product in each crop and group crops that show the SAME product (same SKU, same flavor, same size).

RULES:
1. Every crop_id (from #1 to the total shown) must appear in EXACTLY ONE group. Do not skip any and do not assign one crop to multiple groups.
2. Different flavors, sizes, or varieties of the same brand are SEPARATE products (separate groups). Example: "Coca-Cola Original 330ml" and "Coca-Cola Zero 330ml" are TWO groups.
3. Use the ORIGINAL shelf photo for context: price labels, shelf layout, and product positioning.
4. Do NOT count facings yourself — the object detector already did that. Just group the crops by identity.

PRICE ASSIGNMENT:
In Spanish supermarkets, price labels are on the shelf edge BELOW the product. Assign each price label to the product group positioned directly above it. Return the currency as ISO 4217 code (EUR, USD, GBP, etc.). Return price as a plain number WITHOUT any symbol. If no price is visible for a product, set both price and currency to null.

OUT OF STOCK:
If you see an empty gap on the shelf in the original image where NO crops were detected, add an entry with crop_ids: [], is_oos: true, and describe the location in product_name (e.g. "Empty gap - shelf 2 center").

POSITION:
position_x and position_y represent the CENTER of the product group on the shelf (0.0 = far left/top, 1.0 = far right/bottom). Estimate from where the group's crops appear in the original image.

PARTIAL PRODUCTS:
If a crop is at the edge of the image and clearly shows a product that is cut off, set is_partial: true for that group.

CONFIDENCE:
Rate your confidence in the product identification (0.0 to 1.0). Use lower values (≤ 0.5) for blurry, dark, or hard-to-read crops.

Respond ONLY with a valid JSON object, no markdown fences, no explanation:
{
  "reasoning": "Your step-by-step analysis…",
  "groups": [
    {
      "crop_ids": [1, 2, 3],
      "product_name": "Full specific product name including variant",
      "brand": "Brand name or null",
      "price": float or null,
      "currency": "EUR" or null,
      "position_x": float,
      "position_y": float,
      "is_oos": false,
      "is_partial": false,
      "confidence": float
    }
  ]
}"""

# ── Legacy Analysis Prompt (single-pass fallback) ─────────────────────────

LEGACY_ANALYSIS_PROMPT = """You are an expert retail shelf analyst. Analyze this supermarket shelf image with maximum precision.

CRITICAL DEFINITION — WHAT IS A "FACING"?
A "facing" is STRICTLY one product unit whose FRONT FACE is visible in the FIRST ROW of the shelf — the row closest to the customer.

MANDATORY DEPTH RULE:
- ONLY count products in the very first row (the front edge of the shelf).
- NEVER count products behind the first row. Even if you can partially see a second or third row of the same product stacked in depth, those DO NOT count.
- Depth is IRRELEVANT. If there are 3 identical boxes one behind the other, that is 1 facing, NOT 3.

VERTICAL STACKING RULE:
- Products stacked VERTICALLY on top of each other in the front row DO count as separate facings.
- Example: 2 boxes of the same cereal stacked on top of each other at the front edge = 2 facings.

STEP-BY-STEP PROCEDURE:

STEP 1: IDENTIFY SHELF LEVELS
List every horizontal shelf level visible in the image from top to bottom (e.g., "Shelf 1 (top)", "Shelf 2", "Shelf 3 (bottom)").

STEP 2: SCAN EACH SHELF LEFT TO RIGHT
For each shelf level, scan from left to right. For each product you identify, count ONLY the units whose front face is at the very front edge of the shelf. Ignore anything behind them.

STEP 3: SPATIAL GROUNDING — BUILD A COUNTING TABLE
In the "reasoning" field you MUST build a markdown table with exactly these columns BEFORE generating the products array:

| Shelf | Product | Front-row units | Notes |

Rules for filling the table:
- One row per product per shelf level. Do NOT skip any product.
- "Front-row units": list the horizontal position of EACH unit you count (e.g., "left, center, right → 3"). You are FORBIDDEN from writing just a number — you must name each position first, then write the total.
- "Notes": mention if you see depth behind the front row (and confirm you are ignoring it), if the product is partially cut off (is_partial), or any other observation.
- Use the price tags / price labels on the shelf edge as visual anchors to determine where one product block ends and another begins. Price tags mark the boundaries of each product's allocated space.

EXAMPLE TABLE (for illustration only — your actual table must reflect the real image):
| Shelf | Product | Front-row units | Notes |
|-------|---------|-----------------|-------|
| 2 | Nature Valley Crunchy | left, center, right → 3 | 2 more boxes visible behind front row — ignored |
| 2 | Digestive Avena | left, center-left, center, center-right → 4 | |
| 3 | Nature Valley Crunchy | left, right → 2 | partially cut off on right edge, is_partial |

After completing the table, sum facings per product across all shelves to get the final count for each entry.

STEP 4: DISTINGUISH PRODUCT VARIANTS
Different flavors, sizes, or varieties of the same brand are SEPARATE products. Each gets its own entry.
Example: "Barritas Chocolate Leche" and "Barritas Chocolate Blanco" are TWO distinct entries, even if same brand.
Do NOT merge them. Use the full specific product name including the variant descriptor.

STEP 5: HANDLE EDGE PRODUCTS
If a product is partially cut off at the left, right, top, or bottom edge of the image, INCLUDE it as an entry. Set is_partial: true. Count only the facings that are actually visible. Each partial product still counts as at least 1 facing.

STEP 6: AGGREGATE
- If the same product appears on multiple shelf levels, output ONE entry with facings summed across all levels.

STEP 7: SELF-CHECK (mandatory — do this before writing the JSON)
Answer these three questions in the "reasoning" field, right after the table:
1. DUPLICATES — Does any product appear more than once in my final list? If yes → merge into one entry and sum facings.
2. DEPTH — Did I accidentally count units behind the front row as extra facings? If yes → subtract them now.
3. EDGE PRODUCTS — Did I include every product that is partially visible at the edges of the image with is_partial: true? If I missed any → add them.
Only after answering all three questions, proceed to generate the JSON.

SANITY CHECK:
- A standard supermarket shelf section typically shows between 15 and 80 total visible front-row facings.
- If your total is outside this range, re-examine your table.

PERSPECTIVE CORRECTION:
If the photo is taken at an angle (not perfectly frontal), only count products clearly in the front row at the near edge. Products appearing smaller in the background are NOT first row.

IGNORE THESE — they are NOT products:
- Price tag rails or label strips
- Promotional signs or banners
- Shelf dividers or plastic separators
- Reflections in glass/mirrors
- Products clearly fallen over (set confidence 0.3 max)

PRICE ASSIGNMENT RULE:
In Spanish supermarkets (Mercadona, Carrefour, etc.), price labels are typically on the shelf edge BELOW the product, not on the packaging. Assign each price label to the product directly above it.

LOW CONFIDENCE ZONES:
If part of the image is blurry, dark, or overexposed, still detect products but set confidence ≤ 0.5 for those zones.

RULES:

1. NO DUPLICATES: Each unique product (same SKU/reference) must appear as exactly ONE entry.

2. CURRENCY DETECTION: Look at the price labels/tags on the shelf. Detect the local currency symbol or code (€, $, £, etc.). Return the currency as ISO 4217 code (EUR, USD, GBP, etc.). Return the price as a plain number WITHOUT any symbol. If no price is visible, set both price and currency to null.

3. POSITION: position_x and position_y represent the CENTER of where this product is primarily located (0.0 = far left/top, 1.0 = far right/bottom). If the product spans multiple shelf levels, use the center of its largest concentration.

4. OUT OF STOCK: Identify empty shelf gaps (visible shelf space with no product) as separate entries with is_oos: true. Set product_name to a description like "Empty gap - top shelf left".

For EVERY unique product, return:
- product_name: full specific product name including variant (flavor, size, type) as shown on packaging
- brand: brand name
- facings: TOTAL front-row-only units summed across ALL shelf levels (integer). NEVER count depth.
- price: numeric value from shelf label, null if not visible
- currency: ISO 4217 code detected from price labels, null if no price
- position_x: horizontal center (0.0 = far left, 1.0 = far right)
- position_y: vertical center (0.0 = top shelf, 1.0 = bottom shelf)
- is_oos: true only for empty gaps, false for products
- is_partial: true if the product is cut off at any image edge
- confidence: your confidence in this detection from 0.0 to 1.0

Respond ONLY with a valid JSON object, no markdown, no explanation:
{
  "reasoning": "string",
  "products": [
    {
      "product_name": "string",
      "brand": "string",
      "facings": integer,
      "price": float or null,
      "currency": "string or null",
      "position_x": float,
      "position_y": float,
      "is_oos": boolean,
      "is_partial": boolean,
      "confidence": float
    }
  ],
  "summary": {
    "total_products": integer,
    "total_facings": integer,
    "oos_count": integer,
    "avg_confidence": float
  }
}"""

RETRY_PROMPT = """Your previous response was not valid JSON. You MUST respond with ONLY a raw JSON object. No markdown fences, no explanation, no text before or after. Just the JSON object starting with { and ending with }."""

# ── V2 internal models (for parsing Gemini Phase 2 response) ──────────────


class V2ProductGroup(BaseModel):
    crop_ids: list[int] = Field(default_factory=list)
    product_name: str
    brand: str | None = None
    price: float | None = None
    currency: str | None = None
    position_x: float = Field(ge=0.0, le=1.0)
    position_y: float = Field(ge=0.0, le=1.0)
    is_oos: bool = False
    is_partial: bool = False
    confidence: float = Field(ge=0.0, le=1.0)


class V2ClassificationResponse(BaseModel):
    reasoning: str
    groups: list[V2ProductGroup]


# ── Helpers ────────────────────────────────────────────────────────────────


def _get_client() -> genai.Client:
    return genai.Client(api_key=settings.gemini_api_key)


def _parse_response(text: str) -> VisionAnalysisResult:
    """Extract JSON from Gemini response text and validate with Pydantic."""
    cleaned = text.strip()
    while cleaned.startswith("```"):
        first_newline = cleaned.index("\n")
        cleaned = cleaned[first_newline + 1 :]
    if cleaned.endswith("```"):
        cleaned = cleaned[: cleaned.rfind("```")]
    cleaned = cleaned.strip()
    return VisionAnalysisResult.model_validate_json(cleaned)


def _parse_v2_response(text: str) -> V2ClassificationResponse:
    """Extract JSON from Gemini V2 response and validate."""
    cleaned = text.strip()
    while cleaned.startswith("```"):
        first_newline = cleaned.index("\n")
        cleaned = cleaned[first_newline + 1 :]
    if cleaned.endswith("```"):
        cleaned = cleaned[: cleaned.rfind("```")]
    cleaned = cleaned.strip()
    return V2ClassificationResponse.model_validate_json(cleaned)


# ── Public API (signatures unchanged) ─────────────────────────────────────


async def analyze_shelf_image_from_url(image_url: str) -> VisionAnalysisResult:
    """Download an image from URL and analyze it with Gemini 2.5 Flash."""
    headers = {"User-Agent": "1000er.ai/0.1"}
    async with httpx.AsyncClient(timeout=30, headers=headers) as http:
        resp = await http.get(image_url)
        resp.raise_for_status()
        image_bytes = resp.content
        mime_type = resp.headers.get("content-type", "image/jpeg").split(";")[0]

    return await _analyze(image_bytes, mime_type)


async def analyze_shelf_image_from_bytes(
    image_bytes: bytes, mime_type: str = "image/jpeg"
) -> VisionAnalysisResult:
    """Analyze raw image bytes with Gemini 2.5 Flash."""
    return await _analyze(image_bytes, mime_type)


async def analyze_shelf_image_from_base64(
    b64_data: str, mime_type: str = "image/jpeg"
) -> VisionAnalysisResult:
    """Analyze a base64-encoded image with Gemini 2.5 Flash."""
    image_bytes = base64.b64decode(b64_data)
    return await _analyze(image_bytes, mime_type)


# ── Dispatcher ─────────────────────────────────────────────────────────────


async def _analyze(
    image_bytes: bytes, mime_type: str
) -> VisionAnalysisResult:
    """Core analysis: try V2 pipeline, fall back to legacy single-pass."""
    if settings.vision_pipeline == "v2":
        try:
            return await _analyze_v2(image_bytes, mime_type)
        except Exception as exc:
            logger.warning("V2 pipeline failed, falling back to legacy: %s", exc)

    return await _analyze_legacy(image_bytes, mime_type)


# ── V2 Pipeline ────────────────────────────────────────────────────────────


async def _analyze_v2(
    image_bytes: bytes, mime_type: str
) -> VisionAnalysisResult:
    """Two-phase pipeline: detection → mosaic → Gemini classification."""
    # Phase 1: Object detection
    detection_result = await detect_products(image_bytes)

    if not detection_result.detections:
        raise DetectionError("Phase 1 returned 0 detections")

    logger.info(
        "V2 Phase 1: %d detections on %dx%d image",
        len(detection_result.detections),
        detection_result.image_width,
        detection_result.image_height,
    )

    # Generate mosaic(s)
    mosaic_result = generate_mosaics(image_bytes, detection_result)

    logger.info(
        "V2 Mosaic: %d crops, %d mosaic image(s)",
        mosaic_result.total_crops,
        len(mosaic_result.mosaic_bytes),
    )

    # Phase 2: Gemini classification
    classification = await _phase2_classify(
        image_bytes, mime_type, mosaic_result
    )

    # Post-process into VisionAnalysisResult
    return _postprocess_v2(classification, mosaic_result)


async def _phase2_classify(
    image_bytes: bytes,
    mime_type: str,
    mosaic_result: MosaicResult,
) -> V2ClassificationResponse:
    """Send original image + mosaic(s) to Gemini for product classification."""
    client = _get_client()

    # Build content parts: original image + mosaic(s) + prompt
    contents: list[Any] = [
        types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
    ]
    for mosaic_bytes in mosaic_result.mosaic_bytes:
        contents.append(
            types.Part.from_bytes(data=mosaic_bytes, mime_type="image/jpeg")
        )
    contents.append(V2_CLASSIFICATION_PROMPT)

    config = types.GenerateContentConfig(temperature=settings.gemini_v2_temperature)

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=contents,
        config=config,
    )

    # First parse attempt
    try:
        return _parse_v2_response(response.text)
    except (json.JSONDecodeError, ValueError):
        pass

    # Retry with stricter prompt
    contents.append(RETRY_PROMPT)
    retry_response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=contents,
        config=config,
    )

    try:
        return _parse_v2_response(retry_response.text)
    except (json.JSONDecodeError, ValueError) as exc:
        raise RuntimeError(
            f"Gemini V2 returned invalid JSON after retry: "
            f"{retry_response.text[:500]}"
        ) from exc


def _postprocess_v2(
    classification: V2ClassificationResponse,
    mosaic_result: MosaicResult,
) -> VisionAnalysisResult:
    """Convert V2 classification groups into VisionAnalysisResult."""
    # Build a lookup from crop_id → CropInfo
    crop_map = {c.crop_id: c for c in mosaic_result.crops}

    products: list[DetectedProduct] = []
    oos_count = 0

    for group in classification.groups:
        if group.is_oos:
            oos_count += 1
            products.append(
                DetectedProduct(
                    product_name=group.product_name,
                    brand=group.brand,
                    facings=0,
                    price=group.price,
                    currency=group.currency,
                    position_x=group.position_x,
                    position_y=group.position_y,
                    is_oos=True,
                    is_partial=False,
                    confidence=group.confidence,
                )
            )
            continue

        # Compute position from actual crop centres (more accurate than Gemini)
        group_crops = [crop_map[cid] for cid in group.crop_ids if cid in crop_map]
        if group_crops:
            pos_x = sum(c.center_x for c in group_crops) / len(group_crops)
            pos_y = sum(c.center_y for c in group_crops) / len(group_crops)
        else:
            pos_x = group.position_x
            pos_y = group.position_y

        # Detect partial products (crop bbox touching image edge)
        is_partial = group.is_partial or any(
            c.bbox[0] < 0.02 or c.bbox[2] > 0.98
            or c.bbox[1] < 0.02 or c.bbox[3] > 0.98
            for c in group_crops
        )

        products.append(
            DetectedProduct(
                product_name=group.product_name,
                brand=group.brand,
                facings=len(group.crop_ids),
                price=group.price,
                currency=group.currency,
                position_x=round(pos_x, 4),
                position_y=round(pos_y, 4),
                is_oos=False,
                is_partial=is_partial,
                confidence=group.confidence,
            )
        )

    # Validate crop_id coverage
    assigned_ids = set()
    for g in classification.groups:
        assigned_ids.update(g.crop_ids)
    expected_ids = set(range(1, mosaic_result.total_crops + 1))
    missing = expected_ids - assigned_ids
    extra = assigned_ids - expected_ids
    if missing:
        logger.warning("V2 post-process: %d crop_ids not assigned: %s", len(missing), missing)
    if extra:
        logger.warning("V2 post-process: %d unknown crop_ids: %s", len(extra), extra)

    # Build summary — total_facings ALWAYS from Phase 1
    non_oos = [p for p in products if not p.is_oos]
    all_confidences = [p.confidence for p in products]

    summary = AnalysisSummary(
        total_products=len(non_oos),
        total_facings=mosaic_result.total_crops,
        oos_count=oos_count,
        avg_confidence=round(
            sum(all_confidences) / len(all_confidences) if all_confidences else 0.0,
            4,
        ),
    )

    return VisionAnalysisResult(
        reasoning=classification.reasoning,
        products=products,
        summary=summary,
    )


# ── Legacy Pipeline ────────────────────────────────────────────────────────


async def _analyze_legacy(
    image_bytes: bytes, mime_type: str
) -> VisionAnalysisResult:
    """Legacy single-pass analysis: send image to Gemini, parse response."""
    client = _get_client()
    image_part = types.Part.from_bytes(data=image_bytes, mime_type=mime_type)

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=[image_part, LEGACY_ANALYSIS_PROMPT],
    )

    # First attempt to parse
    try:
        return _parse_response(response.text)
    except (json.JSONDecodeError, ValueError):
        pass

    # Retry with stricter prompt
    retry_response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=[image_part, LEGACY_ANALYSIS_PROMPT, RETRY_PROMPT],
    )

    try:
        return _parse_response(retry_response.text)
    except (json.JSONDecodeError, ValueError) as exc:
        raise RuntimeError(
            f"Gemini returned invalid JSON after retry: {retry_response.text[:500]}"
        ) from exc
