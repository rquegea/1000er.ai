"""Crop extraction and numbered mosaic generation for the V2 pipeline.

Takes bounding-box detections from Phase 1 and produces:
  1. Individual crops from the original image.
  2. Spatially sorted, numbered crops.
  3. One or more JPEG mosaic grid images where each cell shows a crop
     with its number clearly visible — ready to send to Gemini for
     Phase 2 classification.
"""

import io
import math
from dataclasses import dataclass, field

from PIL import Image, ImageDraw, ImageFont

from app.config import settings
from app.services.detection import Detection, DetectionResult


@dataclass
class CropInfo:
    """A single crop extracted from the original image."""

    crop_id: int  # 1-based index, matches number drawn on mosaic
    image: Image.Image
    bbox: tuple[float, float, float, float]  # original normalised bbox
    score: float
    center_x: float  # horizontal centre, normalised 0-1
    center_y: float  # vertical centre, normalised 0-1


@dataclass
class MosaicResult:
    """Output of the mosaic generation pipeline."""

    crops: list[CropInfo]  # all crops, sorted and numbered
    mosaic_bytes: list[bytes]  # JPEG bytes of each mosaic grid
    total_crops: int


# ---------------------------------------------------------------------------
# Crop extraction
# ---------------------------------------------------------------------------


def crop_detections(
    image_bytes: bytes,
    detections: list[Detection],
    padding_pct: float = 0.02,
) -> list[CropInfo]:
    """Crop each detection bbox from the original image.

    Args:
        image_bytes: Original shelf image as bytes.
        detections: List of detections with normalised bboxes.
        padding_pct: Extra padding around each bbox as a fraction of
                     image dimensions (default 2%).

    Returns:
        List of CropInfo (not yet numbered — numbering happens after sorting).
    """
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    w, h = img.size

    crops: list[CropInfo] = []
    for det in detections:
        x_min, y_min, x_max, y_max = det.bbox

        # Add padding, clamped to image bounds
        pad_x = padding_pct
        pad_y = padding_pct
        left = max(0.0, x_min - pad_x) * w
        top = max(0.0, y_min - pad_y) * h
        right = min(1.0, x_max + pad_x) * w
        bottom = min(1.0, y_max + pad_y) * h

        # Ensure minimum crop size (at least 4x4 px)
        if (right - left) < 4 or (bottom - top) < 4:
            continue

        crop_img = img.crop((int(left), int(top), int(right), int(bottom)))

        crops.append(
            CropInfo(
                crop_id=0,  # assigned after sorting
                image=crop_img,
                bbox=det.bbox,
                score=det.score,
                center_x=(x_min + x_max) / 2,
                center_y=(y_min + y_max) / 2,
            )
        )

    return crops


# ---------------------------------------------------------------------------
# Spatial sorting
# ---------------------------------------------------------------------------


def sort_crops_spatially(
    crops: list[CropInfo], row_tolerance: float = 0.08
) -> list[CropInfo]:
    """Sort crops into reading order: top→bottom by shelf rows, left→right
    within each row. Assign sequential crop_id (1-based).

    Crops whose ``center_y`` values are within ``row_tolerance`` of each
    other are considered part of the same shelf row.
    """
    if not crops:
        return []

    # Sort by center_y first to group into rows
    by_y = sorted(crops, key=lambda c: c.center_y)

    rows: list[list[CropInfo]] = []
    current_row: list[CropInfo] = [by_y[0]]

    for crop in by_y[1:]:
        if abs(crop.center_y - current_row[0].center_y) <= row_tolerance:
            current_row.append(crop)
        else:
            rows.append(current_row)
            current_row = [crop]
    rows.append(current_row)

    # Sort each row left-to-right
    ordered: list[CropInfo] = []
    for row in rows:
        row.sort(key=lambda c: c.center_x)
        ordered.extend(row)

    # Assign 1-based crop_id
    for i, crop in enumerate(ordered):
        crop.crop_id = i + 1

    return ordered


# ---------------------------------------------------------------------------
# Mosaic grid generation
# ---------------------------------------------------------------------------


def _get_font(size: int = 14) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    """Try to load a reasonable font, fall back to PIL default."""
    try:
        return ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", size)
    except (OSError, IOError):
        pass
    try:
        return ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", size)
    except (OSError, IOError):
        pass
    return ImageFont.load_default()


def build_mosaic(
    crops: list[CropInfo],
    cell_size: int = 150,
    columns: int = 8,
    padding: int = 4,
) -> Image.Image:
    """Build a single numbered grid mosaic from a list of crops.

    Each cell is ``cell_size x cell_size`` pixels. The crop is resized to
    fit inside the cell (maintaining aspect ratio). A number label is drawn
    in the top-left corner of each cell for Gemini to reference.
    """
    n = len(crops)
    rows = math.ceil(n / columns)

    grid_w = columns * cell_size + (columns + 1) * padding
    grid_h = rows * cell_size + (rows + 1) * padding

    mosaic = Image.new("RGB", (grid_w, grid_h), color=(255, 255, 255))
    draw = ImageDraw.Draw(mosaic)
    font = _get_font(size=max(12, cell_size // 8))

    for idx, crop in enumerate(crops):
        col = idx % columns
        row = idx // columns
        x = padding + col * (cell_size + padding)
        y = padding + row * (cell_size + padding)

        # Draw cell background border
        draw.rectangle(
            [x - 1, y - 1, x + cell_size, y + cell_size],
            outline=(200, 200, 200),
            width=1,
        )

        # Resize crop to fit cell while maintaining aspect ratio
        cw, ch = crop.image.size
        scale = min(cell_size / cw, cell_size / ch)
        new_w = max(1, int(cw * scale))
        new_h = max(1, int(ch * scale))
        resized = crop.image.resize((new_w, new_h), Image.LANCZOS)

        # Centre crop in cell
        offset_x = x + (cell_size - new_w) // 2
        offset_y = y + (cell_size - new_h) // 2
        mosaic.paste(resized, (offset_x, offset_y))

        # Draw number label (white text on dark background)
        label = f"#{crop.crop_id}"
        bbox = font.getbbox(label)
        tw = bbox[2] - bbox[0]
        th = bbox[3] - bbox[1]
        label_pad = 3
        draw.rectangle(
            [x + 2, y + 2, x + tw + 2 * label_pad + 2, y + th + 2 * label_pad + 2],
            fill=(30, 30, 30, 200),
        )
        draw.text((x + label_pad + 2, y + label_pad + 2), label, fill="white", font=font)

    return mosaic


def build_mosaic_multiple(
    crops: list[CropInfo],
    cell_size: int = 150,
    columns: int = 8,
    padding: int = 4,
    max_per_mosaic: int = 80,
) -> list[Image.Image]:
    """Build one or more mosaic grids if there are too many crops for one."""
    if not crops:
        return []

    mosaics: list[Image.Image] = []
    for start in range(0, len(crops), max_per_mosaic):
        chunk = crops[start : start + max_per_mosaic]
        mosaics.append(build_mosaic(chunk, cell_size, columns, padding))

    return mosaics


# ---------------------------------------------------------------------------
# Top-level orchestrator
# ---------------------------------------------------------------------------


def generate_mosaics(
    image_bytes: bytes,
    detection_result: DetectionResult,
) -> MosaicResult:
    """Full mosaic pipeline: crop → sort → build grid(s) → return bytes.

    Uses settings for cell_size, columns, padding, max_crops.
    """
    cell_size = settings.mosaic_cell_size
    columns = settings.mosaic_columns
    padding = settings.mosaic_padding
    max_crops = settings.mosaic_max_crops

    # Crop detections from the original image
    crops = crop_detections(image_bytes, detection_result.detections)

    # Sort spatially and assign IDs
    crops = sort_crops_spatially(crops)

    # Limit to max_crops
    if len(crops) > max_crops:
        crops = crops[:max_crops]
        # Re-number
        for i, c in enumerate(crops):
            c.crop_id = i + 1

    # Build mosaic grid(s)
    mosaic_images = build_mosaic_multiple(
        crops, cell_size, columns, padding, max_per_mosaic=max_crops
    )

    # Convert to JPEG bytes
    mosaic_bytes_list: list[bytes] = []
    for m in mosaic_images:
        buf = io.BytesIO()
        m.save(buf, format="JPEG", quality=90)
        mosaic_bytes_list.append(buf.getvalue())

    return MosaicResult(
        crops=crops,
        mosaic_bytes=mosaic_bytes_list,
        total_crops=len(crops),
    )
