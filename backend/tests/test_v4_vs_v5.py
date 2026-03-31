"""Compare V4 (Gemini bbox detection) vs V5 (YOLO bbox detection) side by side.

Requires GEMINI_API_KEY in .env — both pipelines use Gemini for classification.

Usage:
    cd backend
    python -m tests.test_v4_vs_v5 path/to/shelf.jpg
"""

import argparse
import asyncio
import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path

# Load env vars BEFORE importing app modules so API keys are available
from dotenv import load_dotenv
load_dotenv()


def _load_image(path: str) -> tuple[bytes, str]:
    """Return (bytes, mime_type)."""
    ext = Path(path).suffix.lower()
    mime = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}.get(ext, "image/jpeg")
    with open(path, "rb") as f:
        return f.read(), mime


def _product_lines(result) -> list[str]:
    lines = []
    for p in sorted(result.products, key=lambda x: -x.facings):
        brand = p.brand or "?"
        lines.append(
            f"  {brand} — {p.product_name}: {p.facings} facings  (conf: {p.confidence:.2f})"
        )
    return lines


async def _run_v4(image_bytes: bytes, mime_type: str):
    from app.services import vision_v4
    t = time.perf_counter()
    result = await vision_v4.analyze_shelf_image_from_bytes(image_bytes, mime_type)
    elapsed = time.perf_counter() - t
    return result, elapsed


async def _run_v5(image_bytes: bytes, mime_type: str):
    from app.services import vision_v5
    t = time.perf_counter()
    result = await vision_v5.analyze_shelf_image_from_bytes(image_bytes, mime_type)
    elapsed = time.perf_counter() - t
    return result, elapsed


def _print_result(label: str, result, elapsed: float):
    print(f"\n{'─'*60}")
    print(f"  {label}")
    print(f"{'─'*60}")
    print(f"  Total facings  : {result.summary.total_facings}")
    print(f"  Unique products: {result.summary.total_products}")
    print(f"  OOS count      : {result.summary.oos_count}")
    print(f"  Avg confidence : {result.summary.avg_confidence:.2f}")
    print(f"  Time           : {elapsed:.1f}s")
    print()
    lines = _product_lines(result)
    if lines:
        for l in lines:
            print(l)
    else:
        print("  (no products)")


def _print_comparison(v4_result, v4_time: float, v5_result, v5_time: float):
    w = 22
    sep = "─" * (w + 2)

    def row(label: str, v4_val: str, v5_val: str):
        print(f"│ {label:<{w}} │ {v4_val:>8} │ {v5_val:>8} │")

    print(f"\n┌─{sep}─┬──────────┬──────────┐")
    print(f"│ {'Metric':<{w}} │ {'V4':>8} │ {'V5':>8} │")
    print(f"├─{sep}─┼──────────┼──────────┤")
    row("Total facings", str(v4_result.summary.total_facings), str(v5_result.summary.total_facings))
    row("Unique products", str(v4_result.summary.total_products), str(v5_result.summary.total_products))
    row("OOS count", str(v4_result.summary.oos_count), str(v5_result.summary.oos_count))
    row("Avg confidence", f"{v4_result.summary.avg_confidence:.2f}", f"{v5_result.summary.avg_confidence:.2f}")
    row("Time (s)", f"{v4_time:.1f}s", f"{v5_time:.1f}s")
    print(f"└─{sep}─┴──────────┴──────────┘")


def _save_results(image_path: str, v4_result, v4_time: float, v5_result, v5_time: float):
    results_dir = Path(__file__).parent / "results"
    results_dir.mkdir(exist_ok=True)

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_path = results_dir / f"v4_vs_v5_{ts}.json"

    def _result_to_dict(r, elapsed):
        return {
            "total_facings": r.summary.total_facings,
            "total_products": r.summary.total_products,
            "oos_count": r.summary.oos_count,
            "avg_confidence": r.summary.avg_confidence,
            "time_seconds": round(elapsed, 2),
            "products": [
                {
                    "product_name": p.product_name,
                    "brand": p.brand,
                    "facings": p.facings,
                    "price": p.price,
                    "currency": p.currency,
                    "confidence": p.confidence,
                    "is_oos": p.is_oos,
                }
                for p in r.products
            ],
        }

    payload = {
        "timestamp": ts,
        "image": str(image_path),
        "v4": _result_to_dict(v4_result, v4_time),
        "v5": _result_to_dict(v5_result, v5_time),
    }

    out_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False))
    print(f"\n  💾 Results saved to: {out_path}")


async def main_async(image_path: str):
    image_bytes, mime_type = _load_image(image_path)

    print(f"\n── V4 vs V5 Comparison ─────────────────────────────────────────")
    print(f"   Image: {image_path}  ({len(image_bytes)//1024} KB, {mime_type})\n")

    print("Running V4 (Gemini detection + Gemini classify)...")
    v4_result, v4_time = await _run_v4(image_bytes, mime_type)
    _print_result("V4 — Gemini bbox detection + Gemini classify", v4_result, v4_time)

    print("\nRunning V5 (YOLO detection + Gemini classify)...")
    v5_result, v5_time = await _run_v5(image_bytes, mime_type)
    _print_result("V5 — YOLO bbox detection + Gemini classify", v5_result, v5_time)

    _print_comparison(v4_result, v4_time, v5_result, v5_time)
    _save_results(image_path, v4_result, v4_time, v5_result, v5_time)

    print()


def main():
    parser = argparse.ArgumentParser(description="Compare V4 vs V5 vision pipeline")
    parser.add_argument("image", help="Path to shelf image")
    args = parser.parse_args()

    if not os.path.isfile(args.image):
        print(f"❌ File not found: {args.image}")
        sys.exit(1)

    asyncio.run(main_async(args.image))


if __name__ == "__main__":
    main()
