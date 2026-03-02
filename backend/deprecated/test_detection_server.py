#!/usr/bin/env python3
"""Mini debug server for Phase 1 detection — visual testing in the browser.

Run:
    python test_detection_server.py

Then open http://localhost:8001 in your browser.
Upload a shelf image, adjust parameters, and hit "Detectar" to see results.
"""

import base64
import io
import os
import sys

import uvicorn
from fastapi import FastAPI, File, Form, UploadFile
from fastapi.responses import HTMLResponse, JSONResponse
from PIL import Image, ImageDraw, ImageFont

# Ensure the backend package is importable
sys.path.insert(0, os.path.dirname(__file__))

from app.services.detection import ShelfDetector, apply_nms, DetectionResult, Detection
from app.services.mosaic import generate_mosaics

app = FastAPI(title="Detection Debug Server")

# ---------------------------------------------------------------------------
# Shared state: keep the last uploaded image in memory so re-detect
# doesn't require re-uploading.
# ---------------------------------------------------------------------------
_cached_image: bytes | None = None
_cached_raw: list[Detection] | None = None  # raw detections from last API call
_cached_prompt: str | None = None  # prompt used for cached raw detections


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_font(size: int = 16) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for font_path in [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ]:
        try:
            return ImageFont.truetype(font_path, size)
        except (OSError, IOError):
            continue
    return ImageFont.load_default()


def _draw_detections(image_bytes: bytes, detections: list[Detection]) -> bytes:
    """Draw bounding boxes on image, return PNG bytes."""
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    draw = ImageDraw.Draw(img)
    w, h = img.size
    font = _get_font(size=max(14, min(w, h) // 60))

    for idx, det in enumerate(detections, start=1):
        x_min, y_min, x_max, y_max = det.bbox
        left, top, right, bottom = int(x_min * w), int(y_min * h), int(x_max * w), int(y_max * h)

        draw.rectangle([left, top, right, bottom], outline=(0, 255, 0), width=2)

        label = f"#{idx} {det.score:.2f}"
        bbox = font.getbbox(label)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]

        draw.rectangle([left, top - th - 6, left + tw + 8, top], fill=(0, 0, 0, 200))
        draw.text((left + 4, top - th - 4), label, fill=(0, 255, 0), font=font)

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


# ---------------------------------------------------------------------------
# HTML page (embedded)
# ---------------------------------------------------------------------------

HTML_PAGE = """<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Phase 1 Detection Debug</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
         background: #0f1117; color: #e0e0e0; padding: 20px; }
  h1 { font-size: 1.4rem; margin-bottom: 16px; color: #58a6ff; }
  .controls { background: #161b22; border: 1px solid #30363d; border-radius: 8px;
              padding: 16px; margin-bottom: 16px; display: flex; flex-wrap: wrap;
              gap: 16px; align-items: end; }
  .control-group { display: flex; flex-direction: column; gap: 4px; }
  .control-group label { font-size: 0.8rem; color: #8b949e; }
  .control-group input[type=range] { width: 200px; }
  .control-group input[type=text] { background: #0d1117; border: 1px solid #30363d;
    color: #e0e0e0; padding: 6px 10px; border-radius: 4px; width: 360px; font-size: 0.85rem; }
  .val { font-size: 0.85rem; color: #58a6ff; font-weight: 600; min-width: 40px; display: inline-block; }
  button { background: #238636; color: #fff; border: none; padding: 8px 20px;
           border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 0.9rem; }
  button:hover { background: #2ea043; }
  button:disabled { background: #21262d; color: #484f58; cursor: not-allowed; }
  .summary { background: #161b22; border: 1px solid #30363d; border-radius: 8px;
             padding: 12px 16px; margin-bottom: 16px; font-size: 0.95rem; }
  .summary strong { color: #58a6ff; }
  .images { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
  .images .panel { background: #161b22; border: 1px solid #30363d; border-radius: 8px;
                   padding: 12px; overflow: hidden; }
  .images .panel h3 { font-size: 0.85rem; color: #8b949e; margin-bottom: 8px; }
  .images img { width: 100%; height: auto; border-radius: 4px; }
  table { width: 100%; border-collapse: collapse; background: #161b22;
          border: 1px solid #30363d; border-radius: 8px; overflow: hidden; }
  thead { background: #21262d; }
  th, td { padding: 8px 12px; text-align: left; font-size: 0.82rem; border-bottom: 1px solid #21262d; }
  th { color: #8b949e; font-weight: 600; }
  td { color: #c9d1d9; font-family: 'SF Mono', monospace; }
  .dropzone { border: 2px dashed #30363d; border-radius: 8px; padding: 40px;
              text-align: center; color: #484f58; cursor: pointer; transition: 0.2s; }
  .dropzone.dragover { border-color: #58a6ff; background: rgba(88,166,255,0.05); color: #58a6ff; }
  .dropzone.has-file { border-color: #238636; color: #3fb950; padding: 12px; }
  .spinner { display: none; }
  .spinner.active { display: inline-block; margin-left: 8px; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .spinner::after { content: ''; display: inline-block; width: 16px; height: 16px;
    border: 2px solid #30363d; border-top-color: #58a6ff; border-radius: 50%;
    animation: spin 0.6s linear infinite; vertical-align: middle; }
  .hidden { display: none; }
</style>
</head>
<body>
<h1>Phase 1 — Detection Debug Server</h1>

<div class="controls">
  <div class="control-group">
    <label>Imagen</label>
    <div class="dropzone" id="dropzone">
      Arrastra una imagen o haz clic para seleccionar
      <input type="file" id="fileInput" accept="image/*" style="display:none">
    </div>
  </div>
</div>

<div class="controls">
  <div class="control-group">
    <label>Confidence threshold: <span class="val" id="confVal">0.15</span></label>
    <input type="range" id="confidence" min="0.05" max="0.50" step="0.05" value="0.15">
  </div>
  <div class="control-group">
    <label>NMS IoU threshold: <span class="val" id="nmsVal">0.45</span></label>
    <input type="range" id="nms" min="0.20" max="0.70" step="0.05" value="0.45">
  </div>
  <div class="control-group">
    <label>Text prompt</label>
    <input type="text" id="prompt" value="product . bottle . box . can . package . bag . carton . food">
  </div>
  <div class="control-group" style="justify-content:end">
    <button id="detectBtn" disabled>Detectar <span class="spinner" id="spinner"></span></button>
  </div>
</div>

<div id="results" class="hidden">
  <div class="summary" id="summary"></div>
  <div class="images">
    <div class="panel">
      <h3>Detecciones (bounding boxes)</h3>
      <img id="detImg" src="" alt="detection">
    </div>
    <div class="panel">
      <h3>Mosaico numerado (input para Gemini)</h3>
      <img id="mosImg" src="" alt="mosaic">
    </div>
  </div>
  <table>
    <thead><tr><th>#</th><th>Score</th><th>Label</th><th>BBox (x_min, y_min, x_max, y_max)</th></tr></thead>
    <tbody id="detTable"></tbody>
  </table>
</div>

<script>
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const confSlider = document.getElementById('confidence');
const nmsSlider = document.getElementById('nms');
const confVal = document.getElementById('confVal');
const nmsVal = document.getElementById('nmsVal');
const detectBtn = document.getElementById('detectBtn');
const spinner = document.getElementById('spinner');
let selectedFile = null;

confSlider.addEventListener('input', () => confVal.textContent = parseFloat(confSlider.value).toFixed(2));
nmsSlider.addEventListener('input', () => nmsVal.textContent = parseFloat(nmsSlider.value).toFixed(2));

dropzone.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('dragover'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
dropzone.addEventListener('drop', e => {
  e.preventDefault();
  dropzone.classList.remove('dragover');
  if (e.dataTransfer.files.length) setFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', () => { if (fileInput.files.length) setFile(fileInput.files[0]); });

function setFile(f) {
  selectedFile = f;
  dropzone.textContent = f.name;
  dropzone.classList.add('has-file');
  detectBtn.disabled = false;
}

detectBtn.addEventListener('click', async () => {
  if (!selectedFile) return;
  detectBtn.disabled = true;
  spinner.classList.add('active');

  const fd = new FormData();
  fd.append('image', selectedFile);
  fd.append('confidence', confSlider.value);
  fd.append('nms', nmsSlider.value);
  fd.append('prompt', document.getElementById('prompt').value);

  try {
    const res = await fetch('/detect', { method: 'POST', body: fd });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch(e) {
      alert('Invalid JSON response: ' + text.substring(0, 200));
      return;
    }

    if (data.error) { alert('Error: ' + data.error); return; }

    const s = data.stats;
    console.log('Response stats:', s);

    document.getElementById('summary').innerHTML =
      `<strong>${s.nms_count} detecciones</strong> en imagen de ` +
      `<strong>${s.image_width}x${s.image_height}</strong> ` +
      `(${s.raw_count} raw &rarr; ${s.filtered_count} tras conf &rarr; ${s.nms_count} tras NMS)`;

    if (data.detection_image) {
      document.getElementById('detImg').src = 'data:image/png;base64,' + data.detection_image;
    } else {
      document.getElementById('detImg').src = '';
    }
    if (data.mosaic_image) {
      document.getElementById('mosImg').src = 'data:image/png;base64,' + data.mosaic_image;
    } else {
      document.getElementById('mosImg').src = '';
      if (s.nms_count === 0) {
        document.getElementById('mosImg').alt = 'Sin detecciones - no hay mosaico';
      }
    }

    const tbody = document.getElementById('detTable');
    if (s.detections.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#8b949e">Sin detecciones</td></tr>';
    } else {
      tbody.innerHTML = s.detections.map(d =>
        `<tr><td>#${d.id}</td><td>${d.score.toFixed(3)}</td><td>${d.label}</td>` +
        `<td>(${d.bbox.map(v => v.toFixed(4)).join(', ')})</td></tr>`
      ).join('');
    }

    document.getElementById('results').classList.remove('hidden');
  } catch (err) {
    alert('Request failed: ' + err.message);
    console.error(err);
  } finally {
    detectBtn.disabled = false;
    spinner.classList.remove('active');
  }
});
</script>
</body>
</html>"""


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/", response_class=HTMLResponse)
async def index():
    return HTML_PAGE


@app.post("/detect")
async def detect(
    image: UploadFile = File(None),
    confidence: float = Form(0.15),
    nms: float = Form(0.45),
    prompt: str = Form("product . bottle . box . can . package . bag . carton . food"),
):
    global _cached_image, _cached_raw, _cached_prompt

    # Detect if a new image was uploaded
    new_image = False
    if image and image.filename:
        _cached_image = await image.read()
        _cached_raw = None  # invalidate raw cache
        new_image = True
    if _cached_image is None:
        return JSONResponse({"error": "No image uploaded"}, status_code=400)

    image_bytes = _cached_image

    # Get image dimensions
    img = Image.open(io.BytesIO(image_bytes))
    img_w, img_h = img.size
    img.close()

    # Only call API again if new image was uploaded; otherwise reuse cached raw
    need_api_call = _cached_raw is None

    if need_api_call:
        detector = ShelfDetector()
        detector.text_prompt = prompt

        print(f"[detect] CALLING API — image={img_w}x{img_h}")
        print(f"[detect] api_url={detector.api_url}")

        try:
            raw = await detector._detect_via_api(image_bytes, img_w, img_h)
            _cached_raw = raw
            _cached_prompt = prompt
        except Exception as exc:
            print(f"[detect] ERROR: {exc}")
            import traceback; traceback.print_exc()
            return JSONResponse({"error": str(exc)}, status_code=500)
    else:
        raw = _cached_raw
        print(f"[detect] USING CACHE — {len(raw)} raw detections")

    raw_count = len(raw)
    print(f"[detect] raw={raw_count}, conf={confidence}, nms={nms}")

    # Local filtering by confidence and NMS
    filtered = [d for d in raw if d.score >= confidence]
    filtered_count = len(filtered)

    cleaned = apply_nms(filtered, nms)
    nms_count = len(cleaned)
    print(f"[detect] → filtered={filtered_count} → nms={nms_count}")

    # Draw detection image
    det_png = _draw_detections(image_bytes, cleaned)
    det_b64 = base64.b64encode(det_png).decode()

    # Generate mosaic
    mos_b64 = ""
    if cleaned:
        det_result = DetectionResult(detections=cleaned, image_width=img_w, image_height=img_h)
        mosaic_result = generate_mosaics(image_bytes, det_result)
        if mosaic_result.mosaic_bytes:
            # Convert JPEG to PNG for consistency
            mos_img = Image.open(io.BytesIO(mosaic_result.mosaic_bytes[0]))
            buf = io.BytesIO()
            mos_img.save(buf, format="PNG")
            mos_b64 = base64.b64encode(buf.getvalue()).decode()

    # Build detections list
    det_list = [
        {
            "id": idx,
            "score": d.score,
            "label": d.label,
            "bbox": list(d.bbox),
        }
        for idx, d in enumerate(cleaned, start=1)
    ]

    return {
        "detection_image": det_b64,
        "mosaic_image": mos_b64,
        "stats": {
            "raw_count": raw_count,
            "filtered_count": filtered_count,
            "nms_count": nms_count,
            "image_width": img_w,
            "image_height": img_h,
            "detections": det_list,
        },
    }


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8002, help="Port (default 8002)")
    args = parser.parse_args()
    print(f"Detection debug server starting on http://localhost:{args.port}")
    uvicorn.run(app, host="0.0.0.0", port=args.port)
