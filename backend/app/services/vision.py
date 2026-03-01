"""GPT-4 Vision integration for shelf image analysis — powered by Gemini 2.5 Flash."""

import json
import base64
import httpx
from google import genai
from google.genai import types

from app.config import settings
from app.models.vision import VisionAnalysisResult

ANALYSIS_PROMPT = """You are an expert retail shelf analyst. Analyze this supermarket shelf image with maximum precision.

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

STEP 3: WRITE YOUR REASONING
In the "reasoning" field, explain your counting process shelf by shelf BEFORE generating the products array. For each shelf level, list what you see and how many front-row facings each product has. This is your scratch pad — use it to think step by step.

STEP 4: DISTINGUISH PRODUCT VARIANTS
Different flavors, sizes, or varieties of the same brand are SEPARATE products. Each gets its own entry.
Example: "Barritas Chocolate Leche" and "Barritas Chocolate Blanco" are TWO distinct entries, even if same brand.
Do NOT merge them. Use the full specific product name including the variant descriptor.

STEP 5: HANDLE EDGE PRODUCTS
If a product is partially cut off at the left, right, top, or bottom edge of the image, INCLUDE it as an entry. Set is_partial: true. Count only the facings that are actually visible. Each partial product still counts as at least 1 facing.

STEP 6: AGGREGATE AND VERIFY
- If the same product appears on multiple shelf levels, output ONE entry with facings summed across all levels.
- Double-check: did you accidentally count depth as extra facings? If yes, correct it now.
- A standard supermarket shelf section typically shows between 20 and 60 total visible front-row facings.
- Make sure no product appears twice in the list (same name = same entry, sum facings).

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
