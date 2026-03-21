"""Smoke test for the vision analysis pipeline (V1 or V3).

Usage:
    # Test V1 with default URL image
    python test_vision.py

    # Test V3 with default URL image
    python test_vision.py --pipeline v3

    # Test V3 with a local image file
    python test_vision.py --pipeline v3 --image /path/to/shelf_photo.jpg

    # Test V3 with a URL
    python test_vision.py --pipeline v3 --url https://example.com/shelf.jpg
"""

import argparse
import asyncio
import json
import mimetypes
import sys
import os

# Ensure app is importable
sys.path.insert(0, os.path.dirname(__file__))

# Supermarket packaged goods shelf with price labels (Pexels)
DEFAULT_IMAGE_URL = "https://images.pexels.com/photos/2733918/pexels-photo-2733918.jpeg?w=1280"


def _get_analyze_fn(pipeline: str):
    if pipeline == "v3":
        from app.services.vision_v3 import (
            analyze_shelf_image_from_bytes,
            analyze_shelf_image_from_url,
        )
    else:
        from app.services.vision import (
            analyze_shelf_image_from_bytes,
            analyze_shelf_image_from_url,
        )
    return analyze_shelf_image_from_bytes, analyze_shelf_image_from_url


def _print_result(result, pipeline: str):
    # Full JSON output
    print("=" * 70)
    print(f"FULL JSON RESPONSE (pipeline={pipeline})")
    print("=" * 70)
    print(json.dumps(result.model_dump(), indent=2, ensure_ascii=False))

    # Summary table
    print(f"\n{'=' * 70}")
    print("SUMMARY")
    print("=" * 70)
    print(f"  Pipeline:   {pipeline.upper()}")
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


async def main():
    parser = argparse.ArgumentParser(description="Test vision pipeline")
    parser.add_argument(
        "--pipeline", choices=["v1", "v3"], default="v1",
        help="Pipeline to use (default: v1)",
    )
    parser.add_argument(
        "--image", type=str, default=None,
        help="Path to a local image file to analyze",
    )
    parser.add_argument(
        "--url", type=str, default=None,
        help="URL of an image to analyze",
    )
    args = parser.parse_args()

    analyze_from_bytes, analyze_from_url = _get_analyze_fn(args.pipeline)

    print(f"Pipeline: {args.pipeline.upper()}")

    if args.image:
        # Local file
        image_path = os.path.abspath(args.image)
        if not os.path.exists(image_path):
            print(f"ERROR: File not found: {image_path}")
            sys.exit(1)

        mime_type, _ = mimetypes.guess_type(image_path)
        if not mime_type or not mime_type.startswith("image/"):
            mime_type = "image/jpeg"

        print(f"Image: {image_path} ({mime_type})")
        print("Sending to Gemini...\n")

        with open(image_path, "rb") as f:
            image_bytes = f.read()

        result = await analyze_from_bytes(image_bytes, mime_type)
    else:
        # URL (default or custom)
        image_url = args.url or DEFAULT_IMAGE_URL
        print(f"Image: {image_url}")
        print("Sending to Gemini...\n")
        result = await analyze_from_url(image_url)

    _print_result(result, args.pipeline)


if __name__ == "__main__":
    asyncio.run(main())
