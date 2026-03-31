"""Unit test for the YOLO detector module.

No Gemini API key required. Tests model loading and product detection.

Usage:
    cd backend
    python -m tests.test_yolo_detector                    # synthetic image
    python -m tests.test_yolo_detector path/to/shelf.jpg  # real shelf photo
"""

import argparse
import io
import sys
import time

# Load env vars before importing app modules
from dotenv import load_dotenv
load_dotenv()


def _make_synthetic_image() -> bytes:
    """Create a simple white JPEG image with coloured rectangles."""
    from PIL import Image, ImageDraw

    img = Image.new("RGB", (800, 1200), color=(240, 240, 240))
    draw = ImageDraw.Draw(img)

    # Draw fake product blocks across 3 shelf levels
    colours = ["#e74c3c", "#3498db", "#2ecc71", "#f39c12", "#9b59b6"]
    shelf_y = [250, 550, 850]
    x_positions = [60, 190, 320, 450, 580, 710]

    for sy in shelf_y:
        # shelf line
        draw.rectangle([(0, sy + 80), (800, sy + 90)], fill="#888888")
        for i, sx in enumerate(x_positions):
            draw.rectangle(
                [(sx, sy - 70), (sx + 110, sy + 78)],
                fill=colours[i % len(colours)],
                outline="#333333",
                width=2,
            )

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90)
    return buf.getvalue()


def _load_image(path: str) -> bytes:
    with open(path, "rb") as f:
        return f.read()


def main():
    parser = argparse.ArgumentParser(description="Test YOLO detector")
    parser.add_argument("image", nargs="?", help="Path to shelf image (optional)")
    args = parser.parse_args()

    print("\n── YOLO Detector Test ──────────────────────────────────────────\n")

    # ── Step 1: Import ─────────────────────────────────────────────────
    print("1. Importing yolo_detector...")
    try:
        from app.services import yolo_detector
        print("   ✅ Import OK")
    except ImportError as exc:
        print(f"   ❌ Import failed: {exc}")
        print("   👉 Run: pip install ultralytics>=8.0.0 ultralyticsplus>=0.0.28")
        sys.exit(1)
    except Exception as exc:
        print(f"   ❌ Unexpected error: {exc}")
        sys.exit(1)

    # ── Step 2: First model load (may download weights) ────────────────
    print("\n2. Loading YOLO model (first load may download ~25 MB)...")
    t0 = time.perf_counter()
    try:
        model1 = yolo_detector._get_model()
        elapsed = time.perf_counter() - t0
        print(f"   ✅ Model loaded in {elapsed:.1f}s  →  {type(model1).__name__}")
    except RuntimeError as exc:
        print(f"   ❌ Model load failed: {exc}")
        sys.exit(1)

    # ── Step 3: Singleton check ────────────────────────────────────────
    print("\n3. Checking singleton (second call should be instant)...")
    t1 = time.perf_counter()
    model2 = yolo_detector._get_model()
    elapsed2 = time.perf_counter() - t1
    if model1 is model2:
        print(f"   ✅ Same instance returned in {elapsed2*1000:.1f}ms")
    else:
        print(f"   ⚠️  Different instances returned (singleton may not be working)")

    # ── Step 4: Inference ──────────────────────────────────────────────
    if args.image:
        print(f"\n4. Running inference on: {args.image}")
        image_bytes = _load_image(args.image)
        label = "real shelf photo"
    else:
        print("\n4. Running inference on synthetic test image...")
        image_bytes = _make_synthetic_image()
        label = "synthetic image"

    t2 = time.perf_counter()
    try:
        detections = yolo_detector.detect_products(image_bytes)
        inf_time = time.perf_counter() - t2
        print(f"   ✅ Inference complete in {inf_time*1000:.0f}ms ({label})")
    except Exception as exc:
        print(f"   ❌ Inference failed: {exc}")
        sys.exit(1)

    # ── Step 5: Print results ──────────────────────────────────────────
    print(f"\n5. Results: {len(detections)} detections\n")

    if not detections:
        print("   ⚠️  No detections — try a real shelf photo or lower --confidence")
    else:
        print("   First 5 detections:")
        for i, d in enumerate(detections[:5]):
            box = d["box_normalized"]
            print(
                f"     [{i}] box=[{box[0]:4d},{box[1]:4d},{box[2]:4d},{box[3]:4d}]  "
                f"conf={d['confidence']:.3f}  area={d['area']}"
            )

        confs = [d["confidence"] for d in detections]
        print(f"\n   Statistics:")
        print(f"     Total detections : {len(detections)}")
        print(f"     Min confidence   : {min(confs):.3f}")
        print(f"     Max confidence   : {max(confs):.3f}")
        print(f"     Avg confidence   : {sum(confs)/len(confs):.3f}")

    print("\n── Done ────────────────────────────────────────────────────────\n")


if __name__ == "__main__":
    main()
