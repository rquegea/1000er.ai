"""Multi-photo shelf consolidation via Gemini.

Merges product detections from multiple analyses of the same visit,
deduplicating overlapping products and producing a unified result.
"""

import json

from google import genai
from google.genai import types

from app.config import settings
from app.models.vision import VisionAnalysisResult, DetectedProduct, AnalysisSummary


CONSOLIDATION_PROMPT = """\
You are a retail shelf analyst. You are given product detection results from {n} \
different photos of shelves taken during the same store visit.

Some products may appear in multiple photos (duplicates). Your job is to merge \
them into a single unified product list:

1. Identify duplicate products across analyses (same product_name and brand).
2. For duplicates, keep the entry with the highest confidence. Sum facings only \
if the photos clearly cover different shelf sections (different position ranges).
3. For unique products, keep them as-is.
4. Recalculate totals.

Here are the analyses:

{analyses_json}

Respond with ONLY a JSON object:
{{
  "reasoning": "Brief explanation of deduplication decisions",
  "products": [
    {{
      "product_name": "...",
      "brand": "...",
      "facings": 3,
      "price": 1.99,
      "position_x": 0.5,
      "position_y": 0.5,
      "is_oos": false,
      "confidence": 0.9
    }}
  ],
  "summary": {{
    "total_products": 12,
    "total_facings": 35,
    "oos_count": 2,
    "avg_confidence": 0.87
  }}
}}
"""


def _get_client() -> genai.Client:
    return genai.Client(api_key=settings.gemini_api_key)


async def consolidate_analyses(analyses_data: list[dict]) -> VisionAnalysisResult:
    """Consolidate multiple analysis results into a single unified result.

    Args:
        analyses_data: list of dicts, each with 'analysis_id' and 'products' (list of product dicts)
    """
    client = _get_client()

    analyses_json = json.dumps(analyses_data, ensure_ascii=False, indent=2)
    prompt = CONSOLIDATION_PROMPT.format(
        n=len(analyses_data),
        analyses_json=analyses_json,
    )

    config = types.GenerateContentConfig(
        temperature=0.1,
        response_mime_type="application/json",
    )

    response = await client.aio.models.generate_content(
        model=settings.gemini_classify_model,
        contents=prompt,
        config=config,
    )

    raw_text = response.text.strip()
    data = json.loads(raw_text)

    products = []
    for p in data.get("products", []):
        products.append(DetectedProduct(
            product_name=p["product_name"],
            brand=p.get("brand"),
            facings=p.get("facings", 1),
            price=p.get("price"),
            position_x=p.get("position_x", 0.5),
            position_y=p.get("position_y", 0.5),
            is_oos=p.get("is_oos", False),
            confidence=p.get("confidence", 0.7),
        ))

    summary_data = data.get("summary", {})
    oos_count = summary_data.get("oos_count", sum(1 for p in products if p.is_oos))
    total_facings = summary_data.get("total_facings", sum(p.facings for p in products))
    avg_confidence = summary_data.get(
        "avg_confidence",
        (sum(p.confidence for p in products) / len(products)) if products else 0,
    )

    return VisionAnalysisResult(
        reasoning=data.get("reasoning", "Consolidated from multiple analyses"),
        products=products,
        summary=AnalysisSummary(
            total_products=len(products),
            total_facings=total_facings,
            oos_count=oos_count,
            avg_confidence=round(avg_confidence, 2),
        ),
    )
