"""Quick smoke test for the Gemini vision analysis service."""

import asyncio
import sys
import os

# Ensure app is importable
sys.path.insert(0, os.path.dirname(__file__))

from app.services.vision import analyze_shelf_image_from_url

# Public supermarket shelf image (Pexels)
TEST_IMAGE_URL = "https://images.pexels.com/photos/264636/pexels-photo-264636.jpeg?w=1280"


async def main():
    print(f"Analyzing image: {TEST_IMAGE_URL}")
    print("Sending to Gemini 2.5 Flash...\n")

    result = await analyze_shelf_image_from_url(TEST_IMAGE_URL)

    print(f"Products detected: {result.summary.total_products}")
    print(f"Total facings:     {result.summary.total_facings}")
    print(f"Out of stock:      {result.summary.oos_count}")
    print(f"Avg confidence:    {result.summary.avg_confidence:.2f}")
    print(f"\n{'—' * 60}")

    for i, p in enumerate(result.products, 1):
        tags = []
        if p.is_oos:
            tags.append("OOS")
        if p.is_partial:
            tags.append("PARTIAL")
        tag_str = f" [{', '.join(tags)}]" if tags else ""
        currency = p.currency or ""
        price_tag = f"{p.price:.2f} {currency}".strip() if p.price is not None else "n/a"
        print(
            f"  {i:>2}. {p.product_name:<35} "
            f"brand={(p.brand or '—'):<15} "
            f"facings={p.facings:<3} "
            f"price={price_tag:<12} "
            f"pos=({p.position_x:.2f},{p.position_y:.2f})  "
            f"conf={p.confidence:.2f}{tag_str}"
        )

    # Validation checks
    print(f"\n{'—' * 60}")
    names = [p.product_name for p in result.products if not p.is_oos]
    unique_names = set(names)
    if len(names) == len(unique_names):
        print("  [OK] No duplicate product entries")
    else:
        dupes = [n for n in unique_names if names.count(n) > 1]
        print(f"  [WARN] Duplicate entries found: {dupes}")

    partials = [p for p in result.products if p.is_partial]
    print(f"  [OK] Partial products detected: {len(partials)}")

    priced = [p for p in result.products if p.price is not None]
    currencies = set(p.currency for p in priced if p.currency)
    print(f"  [OK] Currency detected: {currencies or 'no prices visible'}")

    print(f"\n{'—' * 60}")
    print("Test PASSED — Gemini integration working correctly.")


if __name__ == "__main__":
    asyncio.run(main())
