"""Quick smoke test for the Gemini vision analysis service."""

import asyncio
import json
import sys
import os

# Ensure app is importable
sys.path.insert(0, os.path.dirname(__file__))

from app.services.vision import analyze_shelf_image_from_url

# Supermarket packaged goods shelf with price labels (Pexels)
TEST_IMAGE_URL = "https://images.pexels.com/photos/2733918/pexels-photo-2733918.jpeg?w=1280"


async def main():
    print(f"Image: {TEST_IMAGE_URL}")
    print("Sending to Gemini 2.5 Flash...\n")

    result = await analyze_shelf_image_from_url(TEST_IMAGE_URL)

    # Full JSON output
    print("=" * 70)
    print("FULL JSON RESPONSE")
    print("=" * 70)
    print(json.dumps(result.model_dump(), indent=2, ensure_ascii=False))

    # Summary table
    print(f"\n{'=' * 70}")
    print("SUMMARY")
    print("=" * 70)
    print(f"  Products:   {result.summary.total_products}")
    print(f"  Facings:    {result.summary.total_facings}")
    print(f"  OOS:        {result.summary.oos_count}")
    print(f"  Confidence: {result.summary.avg_confidence:.2f}")

    # Product table
    print(f"\n{'=' * 70}")
    print("PRODUCTS")
    print("=" * 70)
    for i, p in enumerate(result.products, 1):
        tags = []
        if p.is_oos:
            tags.append("OOS")
        if p.is_partial:
            tags.append("PARTIAL")
        tag_str = f" [{', '.join(tags)}]" if tags else ""
        currency = p.currency or ""
        price_tag = f"{p.price:.2f} {currency}".strip() if p.price is not None else "—"
        print(
            f"  {i:>2}. {p.product_name:<40} "
            f"brand={(p.brand or '—'):<18} "
            f"facings={p.facings:<3} "
            f"price={price_tag:<10} "
            f"pos=({p.position_x:.2f},{p.position_y:.2f}) "
            f"conf={p.confidence:.2f}{tag_str}"
        )

    # Validations
    print(f"\n{'=' * 70}")
    print("VALIDATIONS")
    print("=" * 70)

    names = [p.product_name for p in result.products if not p.is_oos]
    unique_names = set(names)
    dupes = [n for n in unique_names if names.count(n) > 1]
    print(f"  Duplicates:      {'NONE' if not dupes else dupes}")

    partials = [p for p in result.products if p.is_partial]
    print(f"  Partial (edge):  {len(partials)}")

    priced = [p for p in result.products if p.price is not None]
    currencies = set(p.currency for p in priced if p.currency)
    print(f"  Currency:        {currencies or 'no prices visible'}")

    tf = result.summary.total_facings
    if 15 <= tf <= 100:
        print(f"  Facings sanity:  OK ({tf} — within 15-100 range)")
    else:
        print(f"  Facings sanity:  WARNING ({tf} — outside 15-100 range)")

    print(f"\n{'=' * 70}")
    print("TEST PASSED")
    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(main())
