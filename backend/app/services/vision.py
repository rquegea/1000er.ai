"""Shelf image analysis — single-pass Gemini pipeline.

Sends the original shelf photo to Gemini 2.5 Flash with a structured
counting prompt and parses the JSON response into VisionAnalysisResult.
"""

import json
import base64
import logging
from typing import Any

import httpx
from google import genai
from google.genai import types

from app.config import settings
from app.models.vision import (
    AnalysisSummary,
    DetectedProduct,
    VisionAnalysisResult,
)

logger = logging.getLogger("vision")

# ── Analysis Prompt ───────────────────────────────────────────────────────

ANALYSIS_PROMPT = """You are an expert retail shelf analyst with years of experience counting product facings in supermarkets. Analyze this shelf image with maximum precision.

CRITICAL DEFINITIONS:
- A "facing" is ONE product unit whose FRONT FACE is visible in the FIRST ROW of the shelf (closest to the customer).
- Products behind the first row (depth) do NOT count as facings.

DEPTH vs FRONT ROW — HOW TO TELL THE DIFFERENCE:
- If you see identical products in a line going AWAY from the camera (getting smaller/further), that is DEPTH — count only the front one.
- Nature Valley boxes, cereal boxes, and similar products are often stacked 2-3 deep. Only count the ones at the very front edge.
- When in doubt, count FEWER facings rather than more. It is better to undercount by 1 than overcount by 2.
- For transparent bags (like Espelta), count only the bags whose front face is fully visible at the shelf edge.

- Products stacked vertically in the front row DO count as separate facings.
- Different flavors/sizes/varieties of the same brand are SEPARATE products.

YOUR TASK — Follow these steps IN ORDER:

STEP 1: MAP THE SHELF STRUCTURE
Identify every horizontal shelf level visible in the image (top to bottom). Write this in your reasoning.

STEP 2: COUNT FACINGS SHELF BY SHELF
For EACH shelf level, scan left to right and count every individual product facing at the front edge. Write your count for each shelf in the reasoning. Be precise — count each visible front face individually.

STEP 3: CALCULATE TOTAL FACINGS
Sum the facings from all shelf levels. Write the total in your reasoning. A standard supermarket shelf section typically shows between 15 and 45 total visible front-row facings. If your total exceeds 40, double-check that you are not counting depth.

STEP 4: IDENTIFY PRODUCTS
Now group the facings by product identity. For each unique product:
- Read the product name from the packaging (full name including variant/flavor)
- Read the brand name
- Count how many of the facings you counted in Step 2 belong to this product
- Note its approximate position (0.0 = left/top, 1.0 = right/bottom)
- Read the price from the shelf label if visible
- Detect the currency from the price label format

STEP 5: DETECT OUT-OF-STOCK
Look for visible empty gaps on the shelf where products should be but are missing. Each gap is an OOS entry with is_oos: true, facings: 0, and a descriptive name like "Empty gap - [location]".

STEP 6: VERIFY YOUR WORK
- Sum of all product facings MUST equal the total from Step 3
- No product should appear twice (merge if same product on multiple shelves)
- Mark products at image edges as is_partial: true

RULES:
1. NO DUPLICATES: Each unique product = exactly ONE entry. If same product on multiple shelves, sum facings into one entry.
2. EVERY visible product gets an entry, even partially visible ones (is_partial: true).
3. Confidence: 0.9+ if name clearly readable, 0.7-0.9 if partially readable, 0.5-0.7 if guessing from shape/color.
4. Price: read from shelf label. Use null if not visible. Detect currency from label format (€, $, £).
5. Position: estimate (x, y) where 0,0 = top-left corner, 1,1 = bottom-right corner of the image.
6. LANGUAGE: Always write product names in the language shown on the packaging. Do NOT translate or mix languages. If the packaging says "Espelta Sabor Manzana", write exactly that. Do not add translations.
7. CONSERVATIVE COUNTING: When uncertain whether a product is in the front row or behind it, do NOT count it. Accuracy matters more than completeness. Target slightly undercounting rather than overcounting.

Respond with ONLY a JSON object (no markdown, no explanation):
{
  "reasoning": "Step 1: I see 3 shelf levels... Step 2: Shelf 1 (top): [product counts]... Step 3: Total = X... Step 4: Products identified... Step 5: OOS gaps... Step 6: Verification...",
  "products": [
    {
      "product_name": "Full Product Name Including Variant",
      "brand": "Brand Name",
      "facings": 3,
      "price": 1.55,
      "currency": "EUR",
      "position_x": 0.25,
      "position_y": 0.15,
      "is_oos": false,
      "is_partial": false,
      "confidence": 0.92
    }
  ],
  "summary": {
    "total_products": 10,
    "total_facings": 35,
    "oos_count": 1,
    "avg_confidence": 0.85
  }
}

You MUST respond with ONLY a raw JSON object. No markdown fences, no explanation, no text before or after. Just the JSON object starting with { and ending with }."""

RETRY_PROMPT = """Your previous response was not valid JSON. You MUST respond with ONLY a raw JSON object. No markdown fences, no explanation, no text before or after. Just the JSON object starting with { and ending with }."""

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


# ── Core analysis ─────────────────────────────────────────────────────────


async def _analyze(
    image_bytes: bytes, mime_type: str
) -> VisionAnalysisResult:
    """Send image to Gemini and parse the structured JSON response."""
    client = _get_client()
    image_part = types.Part.from_bytes(data=image_bytes, mime_type=mime_type)

    config = types.GenerateContentConfig(
        temperature=settings.gemini_temperature,
    )

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=[image_part, ANALYSIS_PROMPT],
        config=config,
    )

    # First attempt to parse
    try:
        return _parse_response(response.text)
    except (json.JSONDecodeError, ValueError):
        pass

    # Retry with stricter prompt
    retry_response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=[image_part, ANALYSIS_PROMPT, RETRY_PROMPT],
        config=config,
    )

    try:
        return _parse_response(retry_response.text)
    except (json.JSONDecodeError, ValueError) as exc:
        raise RuntimeError(
            f"Gemini returned invalid JSON after retry: {retry_response.text[:500]}"
        ) from exc


# ── Public API ────────────────────────────────────────────────────────────


async def analyze_shelf_image_from_url(image_url: str) -> VisionAnalysisResult:
    """Download an image from a URL and analyze it."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(image_url, follow_redirects=True, timeout=30)
        resp.raise_for_status()

    content_type = resp.headers.get("content-type", "image/jpeg").split(";")[0]
    return await _analyze(resp.content, content_type)


async def analyze_shelf_image_from_bytes(
    image_bytes: bytes, mime_type: str = "image/jpeg"
) -> VisionAnalysisResult:
    """Analyze a shelf image from raw bytes."""
    return await _analyze(image_bytes, mime_type)


async def analyze_shelf_image_from_base64(
    b64_data: str, mime_type: str = "image/jpeg"
) -> VisionAnalysisResult:
    """Analyze a shelf image from a base64-encoded string."""
    image_bytes = base64.b64decode(b64_data)
    return await _analyze(image_bytes, mime_type)
