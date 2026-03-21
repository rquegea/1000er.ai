# 1000er.ai — Retail Shelf Intelligence Platform

## What is this project?

SaaS multi-tenant platform for retail shelf intelligence. Users upload photos of supermarket shelves and the platform detects products, facings, prices, and out-of-stock situations using AI vision.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js (App Router, TypeScript, Tailwind CSS) |
| Backend API | FastAPI (Python 3.11+) |
| Database | PostgreSQL via Supabase |
| Auth | Supabase Auth (JWT, row-level security) |
| Image Storage | Supabase Storage (buckets per tenant) |
| AI Vision | OpenAI GPT-4 Vision API |
| Deployment | Vercel (frontend), Railway/Fly.io (backend) |

## Architecture Decisions

### Multi-tenancy
- **Strategy**: shared database, shared schema, `tenant_id` column in every table.
- Every query MUST filter by `tenant_id`. Use Supabase RLS policies as a safety net.
- API endpoints receive `tenant_id` from the authenticated JWT — never from request params.

### Image Analysis Pipeline
1. User uploads shelf photo → stored in Supabase Storage (`shelves/{tenant_id}/{upload_id}/`).
2. Backend creates an `analysis` record with status `pending`.
3. Background worker sends image to GPT-4 Vision with a structured prompt.
4. Response is parsed into: detected products, facing count, price (if visible), position, out-of-stock flags.
5. Results saved to DB; status updated to `completed`.
6. Frontend polls or uses Supabase Realtime to show results.

### API Design
- RESTful, versioned: `/api/v1/...`
- Auth via Bearer token (Supabase JWT).
- Standard response envelope: `{ data, error, meta }`.

### Data Model (core tables)
- `tenants` — id, name, plan, created_at
- `users` — id, tenant_id, email, role, created_at
- `stores` — id, tenant_id, name, address, chain
- `shelf_uploads` — id, tenant_id, store_id, image_url, uploaded_by, created_at
- `analyses` — id, tenant_id, shelf_upload_id, status, raw_response, created_at
- `detected_products` — id, analysis_id, tenant_id, product_name, brand, facings, price, position_x, position_y, is_oos, confidence

### MVP Scope
- Single-provider support (one supermarket chain per tenant).
- Manual photo upload (no automated capture yet).
- Dashboard: upload history, detection results, basic KPIs (total facings, OOS rate).
- User roles: admin, analyst.

### Post-MVP
- Multi-provider support per tenant.
- Planogram compliance comparison.
- Historical trend analysis.
- Bulk upload and scheduled analysis.
- Webhook/integration API for third-party systems.

## Project Structure

```
1000er.ai/
├── CLAUDE.md
├── frontend/                  # Next.js app
│   ├── src/
│   │   ├── app/               # App Router pages
│   │   │   ├── (auth)/        # Login, signup
│   │   │   ├── dashboard/     # Main dashboard
│   │   │   ├── uploads/       # Upload & review
│   │   │   ├── analysis/      # Analysis results
│   │   │   └── settings/      # Tenant settings
│   │   ├── components/        # Reusable UI components
│   │   ├── lib/               # Supabase client, utils
│   │   ├── hooks/             # Custom React hooks
│   │   └── types/             # TypeScript types
│   ├── public/
│   ├── tailwind.config.ts
│   ├── next.config.ts
│   └── package.json
├── backend/                   # FastAPI app
│   ├── app/
│   │   ├── main.py            # FastAPI entrypoint
│   │   ├── config.py          # Settings / env vars
│   │   ├── deps.py            # Dependency injection (DB, auth)
│   │   ├── models/            # SQLAlchemy / Pydantic models
│   │   ├── routers/           # API route modules
│   │   │   ├── uploads.py
│   │   │   ├── analyses.py
│   │   │   ├── stores.py
│   │   │   └── tenants.py
│   │   ├── services/          # Business logic
│   │   │   ├── vision.py      # GPT-4 Vision integration
│   │   │   └── analysis.py    # Analysis orchestration
│   │   ├── workers/           # Background tasks
│   │   └── utils/
│   ├── alembic/               # DB migrations
│   ├── requirements.txt
│   └── Dockerfile
├── supabase/                  # Supabase config & migrations
│   ├── migrations/
│   └── seed.sql
└── docs/                      # Additional documentation
```

## Coding Conventions

- **Python**: snake_case, type hints everywhere, Pydantic for validation.
- **TypeScript**: camelCase for variables/functions, PascalCase for components/types.
- **SQL**: snake_case, plural table names.
- **Commits**: conventional commits (`feat:`, `fix:`, `chore:`, etc.).
- **Environment variables**: `.env.local` (frontend), `.env` (backend). Never commit secrets.

## Key Environment Variables

### Backend
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
- `OPENAI_API_KEY`
- `DATABASE_URL`

### Frontend
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_API_URL`

## Commands

```bash
# Frontend
cd frontend && npm run dev        # Dev server on :3000
cd frontend && npm run build      # Production build
cd frontend && npm run lint       # Lint

# Backend
cd backend && uvicorn app.main:app --reload   # Dev server on :8000
cd backend && alembic upgrade head            # Run migrations
cd backend && pytest                          # Run tests
```

---

# 1000er.ai — Plan de mejora de precisión de facings (Vision V3)

## Contexto para Claude Code

Este plan es para el proyecto `1000er.ai`, una plataforma SaaS de shelf intelligence. El problema principal es que el pipeline actual de análisis de imágenes de lineal (single-pass a Gemini 2.5 Flash) no es suficientemente preciso contando **facings** (unidades de producto visibles en primera fila del estante).

**Lee `CLAUDE.md` en la raíz del proyecto antes de empezar.** Ahí está la arquitectura completa, stack, estructura de carpetas y convenciones.

---

## Estado actual del código

- **Pipeline activo**: `backend/app/services/vision.py` — single-pass a Gemini 2.5 Flash con un prompt largo que pide conteo + clasificación + precios + OOS en una sola llamada.
- **Pipeline deprecated**: `backend/deprecated/detection.py` y `backend/deprecated/mosaic.py` — pipeline de 2 fases (Roboflow Grounding DINO para detección de bounding boxes + mosaico de crops para clasificación). Fue descartado pero estructura correcta para precisión de conteo.
- **Config**: la variable `VISION_PIPELINE` en `.env` ya existe pero no se usa. El backend siempre ejecuta el single-pass.
- **Modelos API usados**: Gemini 2.5 Flash (clasificación), Roboflow/Grounding DINO (detección, deprecated).
- **Archivos de test**: `backend/test_vision.py` (smoke test del pipeline actual), `backend/deprecated/test_detection.py` y `backend/deprecated/test_detection_server.py` (tests del pipeline V2).

---

## Objetivo

Mejorar la precisión del conteo de facings del ~65% actual al ~90-95%, manteniendo el coste por análisis lo más bajo posible. No buscamos 100% — buscamos el mejor balance precisión/coste.

---

## Plan de implementación — 5 fases

### FASE 1: Pipeline V3 — Split en 2 llamadas a Gemini (sin dependencias externas)

**Por qué**: El approach más eficiente en coste es quedarnos solo con Gemini (sin pagar Roboflow) pero separando el trabajo en 2 llamadas especializadas. Gemini 2.5 Flash es muy barato (~$0.15/1M input tokens) y al dividir las tareas mejora significativamente.

**Qué hacer**:

1. **Crear `backend/app/services/vision_v3.py`** con dos funciones:

   **Llamada 1 — Conteo y localización (`_count_facings`)**:
   - Input: imagen original
   - Prompt corto y específico SOLO para contar:
   ```
   You are a shelf-facing counter. Count ONLY the products whose front face is visible in the FIRST ROW (closest to camera). Products behind the first row (depth) do NOT count.

   METHOD: Scan each shelf level left to right. For each product unit you see at the front edge, assign it a sequential number starting from 1. Write each number as you go.

   Respond with ONLY a JSON object:
   {
     "shelf_levels": [
       {
         "level": 1,
         "description": "top shelf",
         "y_range": [0.0, 0.25],
         "facings": [
           {"id": 1, "x": 0.05, "y": 0.12},
           {"id": 2, "x": 0.15, "y": 0.12},
           ...
         ]
       }
     ],
     "total_facings": 28
   }
   ```
   - Temperature: 0.1 (más determinístico para conteo)
   - **NO pedir nombres, marcas, precios ni nada más**

   **Llamada 2 — Clasificación (`_classify_products`)**:
   - Input: imagen original + output de la llamada 1 (coordenadas de cada facing)
   - Prompt: "Given these {N} detected facings at these positions, identify each product"
   - Aquí sí pedir: nombre, marca, precio, OOS, confianza
   - Agrupar facings del mismo producto
   - Temperature: 0.2 (algo más flexible para lectura de texto)

2. **Crear `backend/app/services/vision_router.py`** que seleccione el pipeline según config:
   ```python
   from app.config import settings

   async def analyze_shelf_image_from_bytes(image_bytes, mime_type):
       if settings.vision_pipeline == "v3":
           from app.services.vision_v3 import analyze as v3_analyze
           return await v3_analyze(image_bytes, mime_type)
       else:
           from app.services.vision import _analyze
           return await _analyze(image_bytes, mime_type)
   ```

3. **Actualizar `app/config.py`**:
   - Añadir `vision_pipeline: str = "v1"` a Settings
   - Añadir `gemini_count_temperature: float = 0.1`
   - Añadir `gemini_classify_temperature: float = 0.2`

4. **Actualizar imports en routers**: `analyses.py` y `visit_photos.py` deben importar desde `vision_router.py` en vez de directamente de `vision.py`.

5. **Mantener `vision.py` intacto** como fallback V1.

**Coste estimado por análisis V3**: ~$0.002-0.004 (2 llamadas Flash con imagen). Similar al V1 actual (1 llamada pero con prompt más largo y response más pesado).

---

### FASE 2: Validación post-procesamiento

**Qué hacer**:

1. **Crear `backend/app/services/validation.py`** con reglas de sanity check:

```python
from app.models.vision import VisionAnalysisResult

class ValidationResult:
    is_valid: bool
    warnings: list[str]
    adjusted_result: VisionAnalysisResult | None

def validate_analysis(result: VisionAnalysisResult) -> ValidationResult:
    warnings = []

    # Rule 1: Total facings sanity (typical shelf is 15-50)
    if result.summary.total_facings > 60:
        warnings.append(f"Unusually high facing count ({result.summary.total_facings}). Possible depth counting.")

    if result.summary.total_facings < 5:
        warnings.append(f"Very low facing count ({result.summary.total_facings}). Possible missed detections.")

    # Rule 2: Single product with too many facings
    for p in result.products:
        if p.facings > 10 and not p.is_oos:
            warnings.append(f"Product '{p.product_name}' has {p.facings} facings — verify.")

    # Rule 3: Sum of facings must match total
    computed_total = sum(p.facings for p in result.products if not p.is_oos)
    if computed_total != result.summary.total_facings:
        warnings.append(f"Facing sum mismatch: products sum={computed_total}, declared total={result.summary.total_facings}")

    # Rule 4: Low average confidence
    if result.summary.avg_confidence < 0.65:
        warnings.append("Low average confidence — results may be unreliable.")

    return ValidationResult(
        is_valid=len(warnings) == 0,
        warnings=warnings,
        adjusted_result=None
    )
```

2. **Integrar en el pipeline**: después de obtener el resultado de Gemini, pasar por `validate_analysis()`. Guardar los warnings en `raw_response` junto al resultado.

3. **Si hay mismatch en el conteo**: hacer una tercera llamada a Gemini pidiendo SOLO que recuente los facings de los productos con warnings. Esto es barato (una llamada Flash más) y corrige muchos errores.

---

### FASE 3: Shelf-level cropping (mejora incremental)

**Por qué**: Cuando la foto tiene 4-5 estanterías, Gemini pierde detalle en las zonas alejadas. Recortar por estantería y analizar cada franja mejora la precisión sin añadir coste de APIs externas.

**Qué hacer**:

1. **Crear `backend/app/services/shelf_splitter.py`**:

```python
from PIL import Image
import io

def split_into_shelves(image_bytes: bytes, num_shelves: int = None) -> list[tuple[bytes, float, float]]:
    """
    Split shelf image into horizontal strips, one per shelf level.
    Returns list of (cropped_image_bytes, y_start_ratio, y_end_ratio).

    If num_shelves is None, use Gemini to detect shelf levels first.
    """
    img = Image.open(io.BytesIO(image_bytes))
    w, h = img.size

    if num_shelves is None:
        # Simple heuristic: divide into 3-4 equal strips
        # (can be improved with edge detection later)
        num_shelves = 3 if h < 1500 else 4

    strip_height = h // num_shelves
    strips = []

    for i in range(num_shelves):
        y_start = i * strip_height
        y_end = (i + 1) * strip_height if i < num_shelves - 1 else h
        crop = img.crop((0, y_start, w, y_end))

        buf = io.BytesIO()
        crop.save(buf, format="JPEG", quality=90)

        strips.append((
            buf.getvalue(),
            y_start / h,  # y_start ratio
            y_end / h      # y_end ratio
        ))

    return strips
```

2. **Integrar como opción en V3**: Si la imagen tiene más de 1500px de alto, hacer split y analizar cada strip por separado con la llamada 1 (conteo), luego unificar coordenadas ajustando los `y` values, y hacer la llamada 2 (clasificación) sobre la imagen completa pasando todas las coordenadas.

**Coste extra**: ~$0.001-0.002 más por las llamadas adicionales de conteo por strip. Marginal.

---

### FASE 4: Dataset de validación y benchmark

**Qué hacer**:

1. **Crear directorio `backend/benchmarks/`** con:
   ```
   benchmarks/
   ├── images/          # 20-30 fotos de lineales reales
   ├── labels/          # JSON con ground truth manual por imagen
   ├── run_benchmark.py # Script que ejecuta V1 y V3 y compara
   └── results/         # Output de cada run
   ```

2. **Formato de labels** (`labels/imagen_001.json`):
   ```json
   {
     "image": "imagen_001.jpg",
     "total_facings": 32,
     "shelf_levels": 4,
     "products": [
       {"name": "Gullón Digestive", "facings": 4},
       {"name": "Fontaneda María", "facings": 3}
     ]
   }
   ```
   No hace falta que sea exhaustivo al principio — con `total_facings` correcto ya puedes medir la métrica más importante.

3. **Script `run_benchmark.py`**:
   ```python
   # Ejecuta ambos pipelines sobre todas las imágenes
   # Calcula: facing_accuracy, product_count_accuracy, time_per_image, cost_estimate
   # Genera report en benchmarks/results/
   ```

4. **Empezar con 10 imágenes** que ya tengáis de tests anteriores. Ampliar a 30 cuando los primeros resultados sean estables.

---

### FASE 5: Optimizaciones de coste

**Qué hacer**:

1. **Cache de imágenes idénticas**: Si la misma imagen se sube dos veces (mismo hash SHA256), devolver el resultado cacheado sin llamar a Gemini. Implementar en el router de análisis.

2. **Resize inteligente antes de enviar a Gemini**: Gemini cobra por tokens de imagen. Redimensionar a max 1920px de lado mayor antes de enviar. La precisión no baja perceptiblemente pero el coste de tokens de imagen se reduce ~40-60% en fotos de alta resolución.

   ```python
   from PIL import Image
   import io

   def optimize_for_api(image_bytes: bytes, max_dimension: int = 1920) -> bytes:
       img = Image.open(io.BytesIO(image_bytes))
       w, h = img.size
       if max(w, h) <= max_dimension:
           return image_bytes
       ratio = max_dimension / max(w, h)
       new_size = (int(w * ratio), int(h * ratio))
       img = img.resize(new_size, Image.LANCZOS)
       buf = io.BytesIO()
       img.save(buf, format="JPEG", quality=85)
       return buf.getvalue()
   ```

3. **Gemini 2.0 Flash para la llamada 1 (conteo)**: Si Gemini 2.0 Flash es suficientemente preciso para el conteo (verificar con benchmark), usarlo en vez de 2.5 Flash para la primera llamada. Es ~50% más barato. La llamada 2 (clasificación) sí necesita 2.5 Flash porque requiere leer texto en packaging.

4. **Batch de strips**: Si haces shelf-level cropping (Fase 3), enviar todos los strips en una sola request multimodal a Gemini en vez de una request por strip.

---

## Orden de ejecución recomendado

| Orden | Fase | Impacto en precisión | Esfuerzo | Coste extra |
|-------|------|----------------------|----------|-------------|
| 1º | Fase 1 (V3 split) | Alto (+15-20%) | Medio | ~$0 (mismo coste) |
| 2º | Fase 2 (validación) | Medio (+5-10%) | Bajo | ~$0.001/análisis |
| 3º | Fase 4 (benchmark) | Indirecto (medición) | Bajo | $0 |
| 4º | Fase 5 (optimización coste) | Ninguno | Bajo | Ahorro ~40% |
| 5º | Fase 3 (shelf split) | Medio (+5-10%) | Medio | ~$0.002/análisis |

**Empieza por Fase 1 + Fase 4 juntas**: implementa V3 y a la vez monta el benchmark con 10 imágenes para poder medir el impacto real.

---

## Instrucciones técnicas para Claude Code

### Convenciones (de CLAUDE.md)
- Python: snake_case, type hints everywhere, Pydantic for validation
- Commits: conventional commits (`feat:`, `fix:`, `chore:`)
- Env vars en `.env`, nunca hardcodeadas

### Archivos a crear
```
backend/app/services/vision_v3.py      # Pipeline V3 (2 llamadas Gemini)
backend/app/services/vision_router.py  # Router que selecciona pipeline
backend/app/services/validation.py     # Post-proceso sanity checks
backend/app/services/image_utils.py    # Resize, hash, shelf splitting
backend/benchmarks/run_benchmark.py    # Script de benchmark
backend/benchmarks/labels/             # Directorio para ground truth
backend/benchmarks/images/             # Directorio para imágenes de test
```

### Archivos a modificar
```
backend/app/config.py                  # Nuevas settings de V3
backend/app/routers/analyses.py        # Importar desde vision_router
backend/app/routers/visit_photos.py    # Importar desde vision_router
backend/.env.example                   # Documentar nuevas variables
```

### Archivos a NO tocar
```
backend/app/services/vision.py         # Mantener como V1 fallback
backend/deprecated/*                   # Referencia, no reactivar
```

### Variables de entorno nuevas
```
VISION_PIPELINE=v3                     # v1 | v3
GEMINI_COUNT_MODEL=gemini-2.5-flash    # Modelo para conteo
GEMINI_CLASSIFY_MODEL=gemini-2.5-flash # Modelo para clasificación
GEMINI_COUNT_TEMPERATURE=0.1
GEMINI_CLASSIFY_TEMPERATURE=0.2
IMAGE_MAX_DIMENSION=1920               # Resize antes de enviar a API
ENABLE_SHELF_SPLITTING=false           # Activar Fase 3
```

### Modelo de datos — sin cambios
El `VisionAnalysisResult` existente en `backend/app/models/vision.py` ya soporta todo lo necesario. V3 debe devolver el mismo modelo para que los routers no necesiten cambios en el response.

### Testing
- Actualizar `backend/test_vision.py` para que acepte `--pipeline v1|v3` como argumento
- El benchmark (Fase 4) es el test real de precisión

---

## Estimación de coste por análisis

| Pipeline | Llamadas API | Coste estimado | Precisión esperada |
|----------|-------------|----------------|-------------------|
| V1 (actual) | 1x Gemini 2.5 Flash | ~$0.003 | ~65% facings |
| V3 (propuesto) | 2x Gemini 2.5 Flash | ~$0.004 | ~85% facings |
| V3 + validación + retry | 2-3x Gemini 2.5 Flash | ~$0.005 | ~90% facings |
| V3 + shelf split | 4-6x Gemini 2.5 Flash | ~$0.008 | ~92-95% facings |

A $0.008/análisis, 10.000 análisis/mes = $80/mes en API. Muy asumible.
