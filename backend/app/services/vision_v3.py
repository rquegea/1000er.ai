"""Shelf image analysis — V3 two-pass Gemini pipeline.

Pass 1: Count facings and locate positions (specialized, high precision).
Pass 1b: Recount if facings-per-level exceeds threshold (depth correction).
Pass 2: Classify products given the counted positions.
Post: Validation sanity checks.

Final output is the same VisionAnalysisResult as V1 for API compatibility.
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
from app.models.vision_v3 import (
    CountingResult,
    ClassificationResult,
)
from app.services.validation import validate_analysis

logger = logging.getLogger("vision_v3")

T = TypeVar("T", bound=BaseModel)

# Maximum facings per shelf level before triggering a recount
MAX_FACINGS_PER_LEVEL = 15

# ── Prompts ───────────────────────────────────────────────────────────────

COUNTING_PROMPT = """You are an expert shelf-facing counter. Your ONLY job is to count product facings at the FRONT EDGE of this supermarket shelf.

CRITICAL DEFINITION:
A "facing" = ONE PHYSICAL PACKAGE/UNIT a customer could pick up. Count PACKAGES, never the contents inside.

PACKAGING RULE — THIS IS THE #2 SOURCE OF ERRORS:
Products come in many package types: boxes, bags, cans, cylinders, blister packs, jars.
For BAGS and TRANSPARENT PACKAGING (very common with snacks, crackers, rice cakes, tortitas):
- A bag of tortitas/galletas/chips = 1 facing, even if you can see 6-8 individual rounds/items INSIDE the bag through the packaging.
- DO NOT count individual items visible inside a bag. The bag itself is the facing.
- Round tortita bags (Bicentury, etc.): count the BAGS, not the circular products inside.
- A transparent bag showing 10 crackers stacked = still 1 facing.

DEPTH TEST — THIS IS THE #1 SOURCE OF ERRORS:
If you see two or more identical products in a line going AWAY from the camera (one partially hidden behind another), that is DEPTH. Count ONLY the one at the very front. For example:
- If you see 4 identical boxes but 2 are behind 2 others → count 2, not 4.
- Nature Valley, cereals, cookies are often stacked 2-3 deep → count only the front ones.
- If a product's front face is partially obscured by another identical product in front of it, the back one is DEPTH.

BEFORE COUNTING — MANDATORY DEPTH ANALYSIS:
For each shelf level, FIRST describe:
1. How many ROWS DEEP are the products stacked? (1 deep, 2 deep, 3 deep?)
2. If products are stacked 2-deep, you should count roughly HALF of what you initially see.
3. If products are stacked 3-deep, you should count roughly ONE THIRD.

METHOD:
1. Identify each horizontal shelf level from top to bottom.
2. For each shelf level, FIRST assess the depth of stacking.
3. Then scan LEFT to RIGHT along the FRONT EDGE ONLY.
4. Assign a sequential ID (starting from 1) to each product unit at the front edge.
5. Record approximate (x, y) position as ratios (0.0 = left/top, 1.0 = right/bottom).
6. Note any visible empty gaps where products are missing (OOS gaps).

CONSERVATIVE COUNTING:
- When uncertain whether a product is in the front row or behind it, do NOT count it.
- Better to undercount by 1 than overcount by 2.
- Products stacked vertically in the front row DO count as separate facings.
- Partially visible products at image edges count (mark is_partial: true).

SANITY CHECK:
A typical supermarket shelf section with 2 levels shows 20-30 total front-row facings (10-15 per level). If your count exceeds 15 per shelf level, you are very likely counting depth. Go back and recount the affected levels.

Respond with ONLY a JSON object (no markdown, no explanation):
{
  "reasoning": "DEPTH ANALYSIS: Level 1 has products stacked 2-deep... Level 2 has products 1-deep... COUNTING: Level 1 (top): scanning front edge L-R I count [details]... Level 2: ...",
  "shelf_levels": [
    {
      "level": 1,
      "description": "top shelf, products stacked 2-deep",
      "y_center": 0.12,
      "facings": [
        {"id": 1, "x": 0.05, "y": 0.12, "is_partial": false},
        {"id": 2, "x": 0.12, "y": 0.12, "is_partial": false}
      ],
      "facing_count": 2
    }
  ],
  "total_facings": 24,
  "oos_gaps": [
    {"x": 0.45, "y": 0.35, "width_estimate": 0.08, "description": "Empty gap between products on shelf 2"}
  ]
}

You MUST respond with ONLY a raw JSON object. No markdown fences, no text before or after."""

RECOUNT_PROMPT_TEMPLATE = """Your previous count of {total} facings across {n_levels} shelf levels seems too high ({per_level:.0f} per level). This usually means you counted DEPTH (products behind the front row).

RECOUNT RULES:
- Only count products whose front face is at the VERY EDGE of the shelf, closest to the customer.
- If you see identical products lined up going AWAY from the camera, count ONLY the front one.
- When uncertain, do NOT count it.
- A typical shelf level has 8-15 front-row facings, NOT 15-25.

Look at the image again and recount carefully.

Respond with ONLY a JSON object (same format as before):
{{
  "reasoning": "RECOUNT: Level 1 products are stacked N-deep, so front row only has... Level 2...",
  "shelf_levels": [...],
  "total_facings": ...,
  "oos_gaps": [...]
}}

You MUST respond with ONLY a raw JSON object. No markdown fences, no text before or after."""

CLASSIFY_PROMPT_TEMPLATE = """You are an expert retail product identifier. A counting pass has already detected {total_facings} product facings on this shelf image at the positions listed below.

DETECTED FACINGS (from counting pass):
{counting_json}

YOUR TASK — Identify each product:
1. Look at each facing position and identify the product there.
2. Group facings of the SAME product into one entry (list their IDs in facing_indices).
3. Read the product name from the packaging (in the language shown — do NOT translate).
4. Read the brand name.
5. Read the price from the shelf label if visible (null if not).
6. Detect currency from the label format (€, $, £).
7. For OOS gaps, create entries with is_oos: true, facings: 0.

RULES:
- The sum of all product facings MUST equal {total_facings}. Do not add or remove facings.
- Each facing ID must appear in exactly one product's facing_indices.
- Confidence: 0.9+ if name clearly readable, 0.7-0.9 if partially readable, 0.5-0.7 if guessing.
- Position: use the average (x, y) of the product's facings.
- LANGUAGE: Write product names exactly as shown on packaging. Do NOT translate.
- DUPLICATES: If two groups of facings are the same product but at different prices, list them as separate entries only if the packaging is visibly different. If it's the same product with different shelf price labels, merge them into one entry and use the most visible price.

VARIANT DIFFERENTIATION — CRITICAL for similar brands:
When a brand (e.g., Bicentury, Gullón Vitalday, Ecocesta) has multiple similar-looking SKUs:
- Look for the specific product name/variant text on each package (e.g., "Maíz", "Avena", "Chocolate", "Arroz Quinoa").
- Even if packaging shapes are identical, different variant text = different product = separate entries.
- Do NOT merge all similar-looking packages from the same brand into one entry.
- A group of identical packages = multiple facings of ONE product. Different package text = separate products.
- When you cannot read the variant text clearly, use the dominant color or visible ingredient illustration to differentiate.

Respond with ONLY a JSON object (no markdown, no explanation):
{{
  "reasoning": "Facing 1-3 are Brand X Product Y... Facing 4-5 are...",
  "products": [
    {{
      "product_name": "Full Product Name Including Variant",
      "brand": "Brand Name",
      "facing_indices": [1, 2, 3],
      "facings": 3,
      "price": 1.55,
      "currency": "EUR",
      "position_x": 0.15,
      "position_y": 0.12,
      "is_oos": false,
      "is_partial": false,
      "confidence": 0.92
    }}
  ]
}}

You MUST respond with ONLY a raw JSON object. No markdown fences, no text before or after."""

RETRY_PROMPT = """Your previous response was not valid JSON. You MUST respond with ONLY a raw JSON object. No markdown fences, no explanation, no text before or after. Just the JSON object starting with { and ending with }."""

# ── Helpers ────────────────────────────────────────────────────────────────


def _get_client() -> genai.Client:
    return genai.Client(api_key=settings.gemini_api_key)


def _parse_json(text: str, model_class: type[T]) -> T:
    """Strip markdown fences from Gemini response and validate with Pydantic."""
    cleaned = text.strip()
    while cleaned.startswith("```"):
        first_newline = cleaned.index("\n")
        cleaned = cleaned[first_newline + 1:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:cleaned.rfind("```")]
    cleaned = cleaned.strip()
    return model_class.model_validate_json(cleaned)


def _call_gemini(
    client: genai.Client,
    model: str,
    contents: list,
    temperature: float,
) -> str:
    """Call Gemini and return the response text."""
    config = types.GenerateContentConfig(temperature=temperature)
    response = client.models.generate_content(
        model=model, contents=contents, config=config,
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

    # Retry with stricter prompt
    retry_text = _call_gemini(
        client, model, contents + [RETRY_PROMPT], temperature,
    )
    try:
        return _parse_json(retry_text, model_class)
    except (json.JSONDecodeError, ValueError) as exc:
        raise RuntimeError(
            f"Gemini returned invalid JSON after retry: {retry_text[:500]}"
        ) from exc


# ── Pass 1: Counting ──────────────────────────────────────────────────────


async def _count_facings(
    client: genai.Client, image_part: types.Part
) -> CountingResult:
    """Call 1: Count and locate facings only."""
    return _call_and_parse(
        client,
        settings.gemini_count_model,
        [image_part, COUNTING_PROMPT],
        settings.gemini_count_temperature,
        CountingResult,
    )


# ── Pass 1b: Recount if too many facings per level ────────────────────────


async def _maybe_recount(
    client: genai.Client,
    image_part: types.Part,
    counting: CountingResult,
) -> CountingResult:
    """If facings-per-level exceeds threshold, trigger a recount pass."""
    n_levels = max(len(counting.shelf_levels), 1)
    per_level = counting.total_facings / n_levels

    if per_level <= MAX_FACINGS_PER_LEVEL:
        return counting

    logger.warning(
        "V3 Recount triggered: %d facings / %d levels = %.1f per level (threshold %d)",
        counting.total_facings, n_levels, per_level, MAX_FACINGS_PER_LEVEL,
    )

    recount_prompt = RECOUNT_PROMPT_TEMPLATE.format(
        total=counting.total_facings,
        n_levels=n_levels,
        per_level=per_level,
    )

    recount = _call_and_parse(
        client,
        settings.gemini_count_model,
        [image_part, recount_prompt],
        settings.gemini_count_temperature,
        CountingResult,
    )

    # Use recount only if it produced a lower (more conservative) total
    if recount.total_facings < counting.total_facings:
        logger.info(
            "V3 Recount accepted: %d → %d facings",
            counting.total_facings, recount.total_facings,
        )
        return recount

    logger.info(
        "V3 Recount rejected (not lower): original=%d, recount=%d",
        counting.total_facings, recount.total_facings,
    )
    return counting


# ── Pass 2: Classification ────────────────────────────────────────────────


async def _classify_products(
    client: genai.Client,
    image_part: types.Part,
    counting: CountingResult,
) -> ClassificationResult:
    """Call 2: Classify products given counted positions."""
    counting_json = counting.model_dump_json(indent=2)
    prompt = CLASSIFY_PROMPT_TEMPLATE.format(
        total_facings=counting.total_facings,
        counting_json=counting_json,
    )

    return _call_and_parse(
        client,
        settings.gemini_classify_model,
        [image_part, prompt],
        settings.gemini_classify_temperature,
        ClassificationResult,
    )


# ── Merge into standard result ────────────────────────────────────────────


def _merge_results(
    counting: CountingResult, classification: ClassificationResult
) -> VisionAnalysisResult:
    """Convert V3 intermediate models to the standard VisionAnalysisResult."""
    products: list[DetectedProduct] = []

    for cp in classification.products:
        products.append(DetectedProduct(
            product_name=cp.product_name,
            brand=cp.brand,
            facings=cp.facings,
            price=cp.price,
            currency=cp.currency,
            position_x=cp.position_x,
            position_y=cp.position_y,
            is_oos=cp.is_oos,
            is_partial=cp.is_partial,
            confidence=cp.confidence,
        ))

    # Add OOS gaps from counting pass that weren't covered in classification
    oos_in_classification = sum(1 for p in products if p.is_oos)
    if oos_in_classification == 0 and counting.oos_gaps:
        for gap in counting.oos_gaps:
            products.append(DetectedProduct(
                product_name=f"Empty gap - {gap.description}" if gap.description else "Empty gap",
                brand=None,
                facings=0,
                price=None,
                currency=None,
                position_x=gap.x,
                position_y=gap.y,
                is_oos=True,
                is_partial=False,
                confidence=0.8,
            ))

    non_oos = [p for p in products if not p.is_oos]
    total_facings = sum(p.facings for p in non_oos)
    total_products = len(products)
    oos_count = sum(1 for p in products if p.is_oos)
    confidences = [p.confidence for p in products if p.confidence is not None]
    avg_confidence = (sum(confidences) / len(confidences)) if confidences else 0.0

    combined_reasoning = (
        f"[V3 Counting] {counting.reasoning}\n\n"
        f"[V3 Classification] {classification.reasoning}"
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


# ── Core analysis ─────────────────────────────────────────────────────────


async def _analyze(
    image_bytes: bytes, mime_type: str
) -> VisionAnalysisResult:
    """Two-pass analysis: count → (recount?) → classify → merge → validate."""
    client = _get_client()
    image_part = types.Part.from_bytes(data=image_bytes, mime_type=mime_type)

    # Pass 1: Count facings
    logger.info("V3 Pass 1: Counting facings...")
    counting = await _count_facings(client, image_part)
    logger.info(
        "V3 Pass 1 complete: %d facings across %d shelf levels",
        counting.total_facings,
        len(counting.shelf_levels),
    )

    # Pass 1b: Recount if suspiciously high
    counting = await _maybe_recount(client, image_part, counting)

    # Pass 2: Classify products
    logger.info("V3 Pass 2: Classifying products...")
    classification = await _classify_products(client, image_part, counting)
    logger.info(
        "V3 Pass 2 complete: %d products identified",
        len(classification.products),
    )

    # Merge and validate
    result = _merge_results(counting, classification)

    validation = validate_analysis(result)
    if validation.warnings:
        logger.warning("V3 Validation warnings: %s", validation.warnings)
        # Append warnings to reasoning for transparency
        result.reasoning += "\n\n[V3 Validation] " + "; ".join(validation.warnings)

    return result


# ── Public API ────────────────────────────────────────────────────────────


async def analyze_shelf_image_from_url(
    image_url: str, tenant_id: str | None = None
) -> VisionAnalysisResult:
    """Download an image from a URL and analyze it."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(image_url, follow_redirects=True, timeout=30)
        resp.raise_for_status()

    content_type = resp.headers.get("content-type", "image/jpeg").split(";")[0]
    return await _analyze(resp.content, content_type)


async def analyze_shelf_image_from_bytes(
    image_bytes: bytes, mime_type: str = "image/jpeg", tenant_id: str | None = None
) -> VisionAnalysisResult:
    """Analyze a shelf image from raw bytes."""
    return await _analyze(image_bytes, mime_type)


async def analyze_shelf_image_from_base64(
    b64_data: str, mime_type: str = "image/jpeg", tenant_id: str | None = None
) -> VisionAnalysisResult:
    """Analyze a shelf image from a base64-encoded string."""
    image_bytes = base64.b64decode(b64_data)
    return await _analyze(image_bytes, mime_type)
