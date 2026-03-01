"""GPT-4 Vision integration for shelf image analysis — powered by Gemini 2.5 Flash."""

import json
import base64
import httpx
from google import genai
from google.genai import types

from app.config import settings
from app.models.vision import VisionAnalysisResult

ANALYSIS_PROMPT = """You are an expert retail shelf analyst. Analyze this supermarket shelf image with maximum precision.

CRITICAL RULES — read carefully before starting:

1. NO DUPLICATES: Each unique product (same SKU/reference) must appear as exactly ONE entry, no matter how many shelf rows or positions it occupies. If "Coca-Cola 330ml" appears on the top shelf AND the bottom shelf, output ONE entry with facings summed across ALL rows.

2. FACINGS = TOTAL VISIBLE UNITS: Count facings as the total number of individual visible units of the same product across the ENTIRE image — every row, every shelf level. Do NOT count only one row. If a product has 3 facings on the top shelf and 4 on the bottom shelf, facings = 7.

3. PARTIALLY VISIBLE PRODUCTS: If a product is partially cut off at the edge of the image, INCLUDE it anyway. Set is_partial: true and count only the facings that are actually visible. Do not ignore edge products.

4. CURRENCY DETECTION: Look at the price labels/tags on the shelf. Detect the local currency symbol or code from the labels (€, $, £, ¥, kr, etc.). Return the currency in the "currency" field as ISO 4217 code (EUR, USD, GBP, JPY, etc.). Return the price as a plain number WITHOUT any currency symbol. If no price is visible, set both price and currency to null.

5. POSITION: position_x and position_y represent the CENTER of where this product is primarily located. If the product spans multiple rows, use the vertical center of its largest concentration.

6. OUT OF STOCK: Identify empty shelf gaps (visible shelf space with no product) as separate entries with is_oos: true. Set product_name to a description of the gap location (e.g. "Empty gap - top shelf left").

For EVERY unique product, return:
- product_name: full product name as shown on packaging
- brand: brand name
- facings: TOTAL visible units across ALL shelf rows (integer)
- price: numeric value from shelf label, null if not visible
- currency: ISO 4217 code detected from price labels, null if no price visible
- position_x: horizontal center as percentage (0.0 = far left, 1.0 = far right)
- position_y: vertical center as percentage (0.0 = top shelf, 1.0 = bottom shelf)
- is_oos: true only for empty gaps, false for products
- is_partial: true if the product is cut off at image edge, false otherwise
- confidence: your confidence in this detection from 0.0 to 1.0

Respond ONLY with a valid JSON object, no markdown, no explanation, exactly this structure:
{
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


def _get_client() -> genai.Client:
    return genai.Client(api_key=settings.gemini_api_key)


def _parse_response(text: str) -> VisionAnalysisResult:
    """Extract JSON from Gemini response text and validate with Pydantic."""
    cleaned = text.strip()
    # Strip markdown code fences if present (```json ... ``` or ``` ... ```)
    while cleaned.startswith("```"):
        first_newline = cleaned.index("\n")
        cleaned = cleaned[first_newline + 1:]
    if cleaned.endswith("```"):
        cleaned = cleaned[: cleaned.rfind("```")]
    cleaned = cleaned.strip()
    return VisionAnalysisResult.model_validate_json(cleaned)


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


async def _analyze(
    image_bytes: bytes, mime_type: str
) -> VisionAnalysisResult:
    """Core analysis: send image to Gemini, parse response, retry once on bad JSON."""
    client = _get_client()
    image_part = types.Part.from_bytes(data=image_bytes, mime_type=mime_type)

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=[image_part, ANALYSIS_PROMPT],
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
    )

    try:
        return _parse_response(retry_response.text)
    except (json.JSONDecodeError, ValueError) as exc:
        raise RuntimeError(
            f"Gemini returned invalid JSON after retry: {retry_response.text[:500]}"
        ) from exc
