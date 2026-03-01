"""Phase 1 — Object detection via Roboflow Serverless API (Grounding DINO).

Detects individual product facings on shelf images using a zero-shot
object detection model. Each bounding box = 1 facing.
"""

import asyncio
import base64
import io
import logging
from dataclasses import dataclass, field

import aiohttp
import numpy as np
from PIL import Image

from app.config import settings

logger = logging.getLogger("detection")


class DetectionError(Exception):
    """Raised when the detection API is unavailable or returns an error."""


@dataclass
class Detection:
    """A single detected object bounding box."""

    bbox: tuple[float, float, float, float]  # (x_min, y_min, x_max, y_max) normalised 0-1
    score: float
    label: str = "product"


@dataclass
class DetectionResult:
    """Full result from Phase 1 detection."""

    detections: list[Detection] = field(default_factory=list)
    image_width: int = 0
    image_height: int = 0


# ---------------------------------------------------------------------------
# NMS (pure numpy, no torchvision)
# ---------------------------------------------------------------------------

def _compute_iou(box_a: np.ndarray, boxes_b: np.ndarray) -> np.ndarray:
    """Compute IoU between one box and an array of boxes.

    All boxes in (x_min, y_min, x_max, y_max) format.
    """
    x1 = np.maximum(box_a[0], boxes_b[:, 0])
    y1 = np.maximum(box_a[1], boxes_b[:, 1])
    x2 = np.minimum(box_a[2], boxes_b[:, 2])
    y2 = np.minimum(box_a[3], boxes_b[:, 3])

    intersection = np.maximum(0, x2 - x1) * np.maximum(0, y2 - y1)

    area_a = (box_a[2] - box_a[0]) * (box_a[3] - box_a[1])
    areas_b = (boxes_b[:, 2] - boxes_b[:, 0]) * (boxes_b[:, 3] - boxes_b[:, 1])

    union = area_a + areas_b - intersection
    return np.where(union > 0, intersection / union, 0.0)


def apply_nms(
    detections: list[Detection], iou_threshold: float = 0.45
) -> list[Detection]:
    """Greedy Non-Maximum Suppression. Returns filtered detections."""
    if not detections:
        return []

    boxes = np.array([d.bbox for d in detections], dtype=np.float64)
    scores = np.array([d.score for d in detections], dtype=np.float64)

    order = scores.argsort()[::-1]
    keep: list[int] = []

    while order.size > 0:
        idx = order[0]
        keep.append(int(idx))

        if order.size == 1:
            break

        remaining = order[1:]
        ious = _compute_iou(boxes[idx], boxes[remaining])
        mask = ious <= iou_threshold
        order = remaining[mask]

    return [detections[i] for i in keep]


# ---------------------------------------------------------------------------
# ShelfDetector
# ---------------------------------------------------------------------------

_RETRY_DELAYS = [10, 30, 60]  # seconds between retries for 503 (cold start)


class ShelfDetector:
    """Detects individual product facings on shelf images."""

    def __init__(self) -> None:
        self.api_url = settings.roboflow_model_url
        self.api_key = settings.roboflow_api_key
        self.text_prompt = settings.detection_text_prompt
        self.confidence_threshold = settings.detection_confidence_threshold
        self.nms_iou_threshold = settings.detection_nms_iou_threshold

    # -- public entry point --------------------------------------------------

    async def detect(self, image_bytes: bytes) -> DetectionResult:
        """Run object detection and return filtered, NMS-cleaned detections."""
        with Image.open(io.BytesIO(image_bytes)) as img:
            width, height = img.size

        raw = await self._detect_via_api(image_bytes, width, height)

        # Filter by confidence
        filtered = [d for d in raw if d.score >= self.confidence_threshold]

        # Apply NMS
        cleaned = apply_nms(filtered, self.nms_iou_threshold)

        logger.info(
            "Detection: %d raw → %d after threshold → %d after NMS",
            len(raw),
            len(filtered),
            len(cleaned),
        )

        return DetectionResult(
            detections=cleaned,
            image_width=width,
            image_height=height,
        )

    # -- API backend ---------------------------------------------------------

    async def _detect_via_api(
        self, image_bytes: bytes, width: int, height: int
    ) -> list[Detection]:
        """Call Roboflow Serverless API (Grounding DINO) via HTTP POST."""
        if not self.api_key:
            raise DetectionError(
                "ROBOFLOW_API_KEY not configured (roboflow_api_key is empty)"
            )

        b64_image = base64.b64encode(image_bytes).decode("utf-8")

        # Convert dot-separated prompt to list: "product . bottle" → ["product", "bottle"]
        text_classes = [t.strip() for t in self.text_prompt.split(".") if t.strip()]

        payload = {
            "api_key": self.api_key,
            "image": {"type": "base64", "value": b64_image},
            "text": text_classes,
            "box_threshold": self.confidence_threshold,
            "text_threshold": self.confidence_threshold,
        }

        last_error: Exception | None = None

        async with aiohttp.ClientSession() as session:
            for attempt in range(1 + len(_RETRY_DELAYS)):
                try:
                    async with session.post(
                        self.api_url,
                        json=payload,
                        timeout=aiohttp.ClientTimeout(total=120),
                    ) as resp:
                        if resp.status == 503:
                            if attempt < len(_RETRY_DELAYS):
                                delay = _RETRY_DELAYS[attempt]
                                logger.warning(
                                    "Roboflow API 503, retry %d/%d in %ds",
                                    attempt + 1,
                                    len(_RETRY_DELAYS),
                                    delay,
                                )
                                await asyncio.sleep(delay)
                                continue
                            raise DetectionError(
                                f"Roboflow API returned 503 after "
                                f"{len(_RETRY_DELAYS)} retries"
                            )

                        if resp.status != 200:
                            body = await resp.text()
                            raise DetectionError(
                                f"Roboflow API returned {resp.status}: "
                                f"{body[:300]}"
                            )

                        data = await resp.json()
                        return self._parse_response(data)

                except (aiohttp.ClientError, asyncio.TimeoutError) as exc:
                    last_error = exc
                    if attempt < len(_RETRY_DELAYS):
                        delay = _RETRY_DELAYS[attempt]
                        logger.warning(
                            "Roboflow API error (%s), retry %d/%d in %ds",
                            exc,
                            attempt + 1,
                            len(_RETRY_DELAYS),
                            delay,
                        )
                        await asyncio.sleep(delay)
                        continue

        raise DetectionError(
            f"Roboflow API failed after all retries: {last_error}"
        )

    # -- response parsing ----------------------------------------------------

    @staticmethod
    def _parse_response(data: dict) -> list[Detection]:
        """Parse Roboflow Grounding DINO response.

        Response format:
        {
            "predictions": [
                {"x": 250.5, "y": 180.3, "width": 80, "height": 120,
                 "confidence": 0.85, "class": "product", ...}
            ],
            "image": {"width": 1200, "height": 900}
        }

        Coordinates are center + dimensions in pixels;
        we convert to normalised (x_min, y_min, x_max, y_max) in 0-1.
        """
        predictions = data.get("predictions", [])
        img_info = data.get("image", {})
        img_w = img_info.get("width", 1)
        img_h = img_info.get("height", 1)

        if not isinstance(predictions, list):
            logger.warning("Unexpected detection response format: %s", type(data))
            return []

        detections: list[Detection] = []
        for item in predictions:
            try:
                cx = float(item["x"])
                cy = float(item["y"])
                w = float(item["width"])
                h = float(item["height"])

                x_min = (cx - w / 2) / img_w
                y_min = (cy - h / 2) / img_h
                x_max = (cx + w / 2) / img_w
                y_max = (cy + h / 2) / img_h

                detections.append(
                    Detection(
                        bbox=(x_min, y_min, x_max, y_max),
                        score=float(item["confidence"]),
                        label=item.get("class", "product"),
                    )
                )
            except (KeyError, TypeError, ValueError) as exc:
                logger.warning("Skipping malformed detection: %s (%s)", item, exc)

        return detections


# ---------------------------------------------------------------------------
# Module-level convenience
# ---------------------------------------------------------------------------

_default_detector: ShelfDetector | None = None


def get_detector() -> ShelfDetector:
    global _default_detector
    if _default_detector is None:
        _default_detector = ShelfDetector()
    return _default_detector


async def detect_products(image_bytes: bytes) -> DetectionResult:
    """Convenience function: detect product facings in a shelf image."""
    detector = get_detector()
    return await detector.detect(image_bytes)
