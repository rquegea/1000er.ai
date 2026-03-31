"""YOLO-only detection test — Pass 1 without Gemini classification.

Useful for debugging YOLO quality before spending Gemini tokens.

Usage:
    cd backend
    python -m tests.test_yolo_only path/to/shelf.jpg
    python -m tests.test_yolo_only path/to/shelf.jpg --confidence 0.30
    python -m tests.test_yolo_only path/to/shelf.jpg --save
"""

import argparse
import io
import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv
load_dotenv()


def _load_image(path: str) -> tuple[bytes, str]:
    ext = Path(path).suffix.lower()
    mime = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}.get(ext, "image/jpeg")
    with open(path, "rb") as f:
        return f.read(), mime


def _annotate_and_save(image_bytes: bytes, detections, output_path: str):
    """Draw bounding boxes on the image and save."""
    from PIL import Image, ImageDraw, ImageFont

    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    w, h = img.size
    draw = ImageDraw.Draw(img)

    for i, det in enumerate(detections):
        box = det.box_2d  # [y_min, x_min, y_max, x_max] in 0-1000
        y_min = int(box[0] / 1000 * h)
        x_min = int(box[1] / 1000 * w)
        y_max = int(box[2] / 1000 * h)
        x_max = int(box[3] / 1000 * w)

        # Green box, 2px border
        for offset in range(2):
            draw.rectangle(
                [(x_min - offset, y_min - offset), (x_max + offset, y_max + offset)],
                outline=(0, 200, 0),
            )

        # Detection number in top-left corner of box
        label = str(i)
        draw.rectangle([(x_min, y_min), (x_min + len(label) * 8 + 4, y_min + 16)], fill=(0, 200, 0))
        draw.text((x_min + 2, y_min + 1), label, fill=(0, 0, 0))

    img.save(output_path, format="JPEG", quality=90)


def main():
    parser = argparse.ArgumentParser(description="YOLO-only detection debug test")
    parser.add_argument("image", help="Path to shelf image")
    parser.add_argument("--confidence", type=float, default=0.25, help="YOLO confidence threshold (default: 0.25)")
    parser.add_argument("--iou", type=float, default=0.45, help="YOLO IoU NMS threshold (default: 0.45)")
    parser.add_argument("--save", action="store_true", help="Save annotated image and detection JSON")
    args = parser.parse_args()

    if not os.path.isfile(args.image):
        print(f"❌ File not found: {args.image}")
        sys.exit(1)

    print(f"\n── YOLO-Only Detection ─────────────────────────────────────────")
    print(f"   Image      : {args.image}")
    print(f"   Confidence : {args.confidence}")
    print(f"   IoU thresh : {args.iou}\n")

    image_bytes, mime_type = _load_image(args.image)

    # ── Step 1: Raw YOLO detections ────────────────────────────────────
    print("1. Running YOLO inference...")
    try:
        from app.services.yolo_detector import detect_products as yolo_detect
    except RuntimeError as exc:
        print(f"   ❌ {exc}")
        sys.exit(1)

    t0 = time.perf_counter()
    raw_yolo = yolo_detect(image_bytes, confidence=args.confidence, iou_threshold=args.iou)
    elapsed = time.perf_counter() - t0
    print(f"   ✅ {len(raw_yolo)} raw detections in {elapsed*1000:.0f}ms\n")

    # ── Step 2: Convert to Detection objects ──────────────────────────
    from app.services.vision_v4 import (
        Detection,
        _filter_detections,
        _deduplicate_depth,
        _cap_per_shelf_level,
    )

    raw_detections = [
        Detection(box_2d=d["box_normalized"], label="product")
        for d in raw_yolo
    ]

    # ── Step 3: Post-processing pipeline ──────────────────────────────
    print("2. Post-processing pipeline:")

    filtered = _filter_detections(raw_detections)
    removed_filter = len(raw_detections) - len(filtered)
    flag_filter = "✅" if removed_filter == 0 else "⚠️ "
    print(f"   {flag_filter} _filter_detections   : {len(raw_detections)} → {len(filtered)}  (removed {removed_filter} invalid boxes)")

    deduped = _deduplicate_depth(filtered)
    removed_dedup = len(filtered) - len(deduped)
    flag_dedup = "✅" if removed_dedup == 0 else "⚠️ "
    print(f"   {flag_dedup} _deduplicate_depth   : {len(filtered)} → {len(deduped)}  (removed {removed_dedup} depth duplicates)")

    capped = _cap_per_shelf_level(deduped)
    removed_cap = len(deduped) - len(capped)
    flag_cap = "✅" if removed_cap == 0 else "⚠️ "
    print(f"   {flag_cap} _cap_per_shelf_level : {len(deduped)} → {len(capped)}  (removed {removed_cap} over-cap)")

    print(f"\n   📦 YOLO raw: {len(raw_yolo)}  →  filtered: {len(filtered)}  →  deduped: {len(deduped)}  →  capped: {len(capped)}\n")

    # ── Step 4: Print final detections ────────────────────────────────
    print("3. Final detections:")
    if not capped:
        print("   ⚠️  No detections remaining after post-processing.")
    else:
        for i, det in enumerate(capped):
            b = det.box_2d
            print(f"   [{i:2d}] y=[{b[0]:4d}–{b[2]:4d}]  x=[{b[1]:4d}–{b[3]:4d}]")

    # ── Step 5: Save annotated image ──────────────────────────────────
    if args.save:
        results_dir = Path(__file__).parent / "results"
        results_dir.mkdir(exist_ok=True)
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")

        img_out = str(results_dir / f"yolo_annotated_{ts}.jpg")
        _annotate_and_save(image_bytes, capped, img_out)
        print(f"\n   🖼️  Annotated image saved: {img_out}")

        json_out = str(results_dir / f"yolo_detections_{ts}.json")
        payload = {
            "timestamp": ts,
            "image": args.image,
            "confidence_threshold": args.confidence,
            "iou_threshold": args.iou,
            "counts": {
                "raw_yolo": len(raw_yolo),
                "after_filter": len(filtered),
                "after_dedup": len(deduped),
                "after_cap": len(capped),
            },
            "detections": [{"index": i, "box_2d": d.box_2d} for i, d in enumerate(capped)],
        }
        Path(json_out).write_text(json.dumps(payload, indent=2))
        print(f"   📄 Detection JSON saved : {json_out}")

    print("\n── Done ────────────────────────────────────────────────────────\n")


if __name__ == "__main__":
    main()
