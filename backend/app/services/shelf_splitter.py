"""Shelf image splitting utilities.

Splits a tall shelf photo into horizontal strips (one per shelf level group)
so that Gemini bbox detection works on a smaller, simpler region at a time.
"""

import io
import logging
from dataclasses import dataclass

from PIL import Image

logger = logging.getLogger("shelf_splitter")

# Minimum height (px) to trigger splitting
MIN_HEIGHT_FOR_SPLIT = 900

# Overlap between strips as a fraction of strip height (avoids missing
# products that sit on the border between two strips)
OVERLAP_RATIO = 0.08


@dataclass
class ImageStrip:
    image_bytes: bytes
    y_start: float  # fraction of original image height, 0.0–1.0
    y_end: float    # fraction of original image height, 0.0–1.0
    mime_type: str


def _n_strips_for(height: int, width: int) -> int:
    """Choose number of strips based on image aspect ratio and height."""
    aspect = height / width if width else 1.0
    if height < MIN_HEIGHT_FOR_SPLIT:
        return 1
    if aspect < 1.0:
        # Landscape — single pass is fine
        return 1
    if height < 1400:
        return 3
    if height < 2000:
        return 4
    return 5


def split_image(image_bytes: bytes, mime_type: str = "image/jpeg") -> list[ImageStrip]:
    """Split a shelf image into horizontal strips with overlap.

    Returns a list of ImageStrip objects. If only 1 strip is needed
    (small or landscape image) returns a single entry covering the full image.
    """
    img = Image.open(io.BytesIO(image_bytes))
    width, height = img.size
    n = _n_strips_for(height, width)

    if n == 1:
        return [ImageStrip(
            image_bytes=image_bytes,
            y_start=0.0,
            y_end=1.0,
            mime_type=mime_type,
        )]

    base_strip_h = height / n
    overlap_px = int(base_strip_h * OVERLAP_RATIO)

    strips: list[ImageStrip] = []
    for i in range(n):
        y0 = max(0, int(i * base_strip_h) - (overlap_px if i > 0 else 0))
        y1 = min(height, int((i + 1) * base_strip_h) + (overlap_px if i < n - 1 else 0))

        crop = img.crop((0, y0, width, y1))
        buf = io.BytesIO()
        # Always save as JPEG for consistent mime_type downstream
        crop.convert("RGB").save(buf, format="JPEG", quality=90)
        strip_bytes = buf.getvalue()

        strips.append(ImageStrip(
            image_bytes=strip_bytes,
            y_start=y0 / height,
            y_end=y1 / height,
            mime_type="image/jpeg",
        ))

    logger.info(
        "shelf_splitter: %dx%d → %d strips (overlap=%dpx)",
        width, height, n, overlap_px,
    )
    return strips


def adjust_boxes_to_global(
    boxes: list[list[int]],
    strip: ImageStrip,
) -> list[list[int]]:
    """Convert bounding boxes from strip-local 0-1000 space to global 0-1000 space.

    Gemini returns [y_min, x_min, y_max, x_max] in [0, 1000].
    We map y coordinates from the strip's local space to the full image.
    x coordinates are unchanged (strips are full width).
    """
    y_offset = strip.y_start  # fraction in original image
    y_scale = strip.y_end - strip.y_start  # fraction of original image this strip covers

    adjusted = []
    for box in boxes:
        y_min, x_min, y_max, x_max = box
        global_y_min = int(y_offset * 1000 + (y_min / 1000) * y_scale * 1000)
        global_y_max = int(y_offset * 1000 + (y_max / 1000) * y_scale * 1000)
        adjusted.append([
            max(0, min(1000, global_y_min)),
            max(0, min(1000, x_min)),
            max(0, min(1000, global_y_max)),
            max(0, min(1000, x_max)),
        ])
    return adjusted
