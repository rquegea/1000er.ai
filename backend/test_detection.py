#!/usr/bin/env python3
"""Standalone test script for Phase 1 (product facing detection).

Runs detect_products on a local image or URL and generates debug images:
  - detection_result.png  — original image with bounding boxes and scores
  - mosaic_result.png     — numbered mosaic grid that Gemini would receive

Usage:
  python test_detection.py foto_lineal.jpg
  python test_detection.py foto_lineal.jpg --confidence 0.20 --nms 0.40
  python test_detection.py https://images.pexels.com/photos/2733918/pexels-photo-2733918.jpeg
  python test_detection.py foto.jpg --prompt "product . bottle . box"
"""

import argparse
import asyncio
import os
import sys
from pathlib import Path

import httpx
from PIL import Image, ImageDraw, ImageFont

# Ensure the backend package is importable
sys.path.insert(0, os.path.dirname(__file__))

from app.services.detection import ShelfDetector, apply_nms, Detection
from app.services.mosaic import generate_mosaics


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Test Phase 1 detection on a shelf image",
    )
    parser.add_argument(
        "image",
        help="Path to a local image file or an HTTP(S) URL",
    )
    parser.add_argument(
        "--confidence",
        type=float,
        default=None,
        help="Override confidence threshold (default: from .env, typically 0.15)",
    )
    parser.add_argument(
        "--nms",
        type=float,
        default=None,
        help="Override NMS IoU threshold (default: from .env, typically 0.45)",
    )
    parser.add_argument(
        "--prompt",
        type=str,
        default=None,
        help='Override text prompt (default: from .env, e.g. "product . bottle . box")',
    )
    return parser.parse_args()


def load_image(source: str) -> tuple[bytes, Path]:
    """Load image bytes from a local path or URL.

    Returns (image_bytes, output_directory).
    """
    if source.startswith("http://") or source.startswith("https://"):
        print(f"Downloading image from {source} ...")
        resp = httpx.get(source, follow_redirects=True, timeout=60)
        resp.raise_for_status()
        return resp.content, Path("/tmp")
    else:
        path = Path(source)
        if not path.exists():
            print(f"ERROR: file not found: {source}")
            sys.exit(1)
        return path.read_bytes(), path.parent or Path(".")


def get_font(size: int = 16) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for font_path in [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ]:
        try:
            return ImageFont.truetype(font_path, size)
        except (OSError, IOError):
            continue
    return ImageFont.load_default()


def draw_detection_image(
    image_bytes: bytes,
    detections: list[Detection],
    output_path: Path,
) -> None:
    """Draw bounding boxes with numbers and scores on the original image."""
    img = Image.open(__import__("io").BytesIO(image_bytes)).convert("RGB")
    draw = ImageDraw.Draw(img)
    w, h = img.size
    font = get_font(size=max(14, min(w, h) // 60))

    for idx, det in enumerate(detections, start=1):
        x_min, y_min, x_max, y_max = det.bbox
        left = int(x_min * w)
        top = int(y_min * h)
        right = int(x_max * w)
        bottom = int(y_max * h)

        # Green bounding box
        draw.rectangle([left, top, right, bottom], outline=(0, 255, 0), width=2)

        # Label: #N  0.XX
        label = f"#{idx} {det.score:.2f}"
        bbox = font.getbbox(label)
        tw = bbox[2] - bbox[0]
        th = bbox[3] - bbox[1]

        # Dark background for readability
        draw.rectangle(
            [left, top - th - 6, left + tw + 8, top],
            fill=(0, 0, 0, 200),
        )
        draw.text((left + 4, top - th - 4), label, fill=(0, 255, 0), font=font)

    img.save(str(output_path), format="PNG")
    print(f"Saved detection debug image → {output_path}")


async def main() -> None:
    args = parse_args()

    # --- Load image ---
    image_bytes, output_dir = load_image(args.image)
    img = Image.open(__import__("io").BytesIO(image_bytes))
    img_w, img_h = img.size
    img.close()
    print(f"Image loaded: {img_w}x{img_h}")

    # --- Build detector with optional overrides ---
    detector = ShelfDetector()

    if args.confidence is not None:
        detector.confidence_threshold = args.confidence
        print(f"  confidence threshold overridden → {args.confidence}")
    if args.nms is not None:
        detector.nms_iou_threshold = args.nms
        print(f"  NMS IoU threshold overridden   → {args.nms}")
    if args.prompt is not None:
        detector.text_prompt = args.prompt
        print(f'  text prompt overridden         → "{args.prompt}"')

    # --- Run detection (intercept raw counts) ---
    print("\nCalling Roboflow API (Grounding DINO) ...")

    # We replicate the detect() logic to capture raw vs filtered vs NMS counts
    import io as _io
    raw = await detector._detect_via_api(image_bytes, img_w, img_h)
    raw_count = len(raw)

    filtered = [d for d in raw if d.score >= detector.confidence_threshold]
    filtered_count = len(filtered)

    cleaned = apply_nms(filtered, detector.nms_iou_threshold)
    nms_count = len(cleaned)

    # Build a DetectionResult for the mosaic pipeline
    from app.services.detection import DetectionResult
    detection_result = DetectionResult(
        detections=cleaned,
        image_width=img_w,
        image_height=img_h,
    )

    # --- Print results ---
    print(f"\n{'='*60}")
    print(f"  Raw detections (before filtering) : {raw_count}")
    print(f"  After confidence >= {detector.confidence_threshold:.2f}        : {filtered_count}")
    print(f"  After NMS (IoU <= {detector.nms_iou_threshold:.2f})           : {nms_count}")
    print(f"{'='*60}\n")

    if cleaned:
        print(f"{'#':>4}  {'Score':>6}  {'Label':<12}  {'BBox (norm x_min,y_min,x_max,y_max)'}")
        print(f"{'─'*4}  {'─'*6}  {'─'*12}  {'─'*42}")
        for idx, det in enumerate(cleaned, start=1):
            x1, y1, x2, y2 = det.bbox
            print(
                f"{idx:>4}  {det.score:>6.3f}  {det.label:<12}  "
                f"({x1:.4f}, {y1:.4f}, {x2:.4f}, {y2:.4f})"
            )
        print()
    else:
        print("No detections found.\n")

    print(f"Resumen: {nms_count} detecciones en imagen de {img_w}x{img_h}\n")

    # --- Generate debug images ---
    # 1) Detection bounding boxes on original
    det_path = output_dir / "detection_result.png"
    draw_detection_image(image_bytes, cleaned, det_path)

    # 2) Numbered mosaic
    if cleaned:
        mosaic_result = generate_mosaics(image_bytes, detection_result)
        for i, mb in enumerate(mosaic_result.mosaic_bytes):
            suffix = f"_{i}" if len(mosaic_result.mosaic_bytes) > 1 else ""
            mosaic_path = output_dir / f"mosaic_result{suffix}.png"
            # Convert JPEG bytes to PNG for consistency
            mosaic_img = Image.open(_io.BytesIO(mb))
            mosaic_img.save(str(mosaic_path), format="PNG")
            print(f"Saved mosaic debug image  → {mosaic_path}")
    else:
        print("Skipping mosaic generation (no detections).")


if __name__ == "__main__":
    asyncio.run(main())
