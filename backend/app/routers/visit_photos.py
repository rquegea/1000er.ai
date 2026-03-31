import asyncio
import csv
import io
import logging
import uuid
from fastapi import APIRouter, Depends, File, Form, UploadFile, HTTPException, Query, status
from fastapi.responses import StreamingResponse

from app.config import settings
from app.deps import get_supabase_client, get_current_user, CurrentUser
from app.services.vision_router import analyze_shelf_image_from_bytes
from app.services.consolidation import consolidate_analyses
from app.models.api import (
    AnalysisDetailOut,
    VisitPhotoOut,
    VisitPhotoListOut,
    VisitSummaryOut,
    VisitOut,
    DetectedProductOut,
    OosProductOut,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/visits", tags=["visit-photos"])

BUCKET_NAME = "visit-photos"


def _ensure_bucket(sb):
    try:
        sb.storage.get_bucket(BUCKET_NAME)
    except Exception:
        sb.storage.create_bucket(BUCKET_NAME, options={"public": False})


def _signed_url(sb, image_url: str) -> str:
    """Return a 1-hour signed URL for a private-bucket image_url."""
    try:
        prefix = f"/storage/v1/object/{BUCKET_NAME}/"
        # Handle both absolute and relative paths
        if prefix in image_url:
            storage_path = image_url.split(prefix, 1)[1]
        else:
            return image_url
        result = sb.storage.from_(BUCKET_NAME).create_signed_url(storage_path, 3600)
        return result.get("signedURL") or result.get("signed_url") or image_url
    except Exception:
        return image_url


def _row_to_photo(row: dict, sb=None) -> VisitPhotoOut:
    url = row["image_url"]
    if sb is not None:
        url = _signed_url(sb, url)
    return VisitPhotoOut(
        id=row["id"],
        tenant_id=row["tenant_id"],
        visit_id=row["visit_id"],
        category=row["category"],
        image_url=url,
        analysis_id=row.get("analysis_id"),
        uploaded_by=row["uploaded_by"],
        notes=row.get("notes"),
        analysis_status=row.get("analysis_status"),
        created_at=row["created_at"],
    )


def _verify_visit_ownership(sb, visit_id: str, tenant_id: str) -> dict:
    """Return the visit row or raise 404."""
    row = (
        sb.table("visits")
        .select("*")
        .eq("id", visit_id)
        .eq("tenant_id", tenant_id)
        .execute()
    )
    if not row.data:
        raise HTTPException(status_code=404, detail="Visit not found")
    return row.data[0]


# ── Upload photo ──────────────────────────────────────────


@router.post(
    "/{visit_id}/photos",
    response_model=VisitPhotoOut,
    status_code=status.HTTP_201_CREATED,
)
async def upload_visit_photo(
    visit_id: str,
    file: UploadFile = File(...),
    category: str = Form(...),
    notes: str | None = Form(None),
    user: CurrentUser = Depends(get_current_user),
):
    """Upload a photo for a visit. If category is 'shelf', auto-runs AI analysis."""
    if category not in ("shelf", "promotion", "activity"):
        raise HTTPException(status_code=422, detail="category must be shelf, promotion, or activity")

    tenant_id = user.tenant_id
    sb = get_supabase_client()

    visit = _verify_visit_ownership(sb, visit_id, tenant_id)
    _ensure_bucket(sb)

    # --- Upload image to storage ---
    image_bytes = await file.read()
    content_type = file.content_type or "image/jpeg"
    ext = content_type.split("/")[-1].replace("jpeg", "jpg")
    file_id = str(uuid.uuid4())
    storage_path = f"{tenant_id}/{visit_id}/{file_id}.{ext}"

    sb.storage.from_(BUCKET_NAME).upload(
        path=storage_path,
        file=image_bytes,
        file_options={"content-type": content_type},
    )

    image_url = f"{settings.supabase_url}/storage/v1/object/{BUCKET_NAME}/{storage_path}"

    # --- For shelf photos, create records and launch async analysis ---
    analysis_id = None
    analysis_status = None
    if category == "shelf":
        store_id = visit["store_id"]

        # Create shelf_uploads record
        upload_row = (
            sb.table("shelf_uploads")
            .insert({
                "tenant_id": tenant_id,
                "store_id": store_id,
                "image_url": image_url,
                "uploaded_by": user.user_id,
            })
            .execute()
        )
        shelf_upload = upload_row.data[0]

        # Create analysis record with pending status
        analysis_row = (
            sb.table("analyses")
            .insert({
                "tenant_id": tenant_id,
                "shelf_upload_id": shelf_upload["id"],
                "status": "pending",
            })
            .execute()
        )
        analysis_id = analysis_row.data[0]["id"]
        analysis_status = "pending"

    # --- Insert visit_photos record (returns immediately) ---
    photo_insert = {
        "tenant_id": tenant_id,
        "visit_id": visit_id,
        "category": category,
        "image_url": image_url,
        "analysis_id": analysis_id,
        "uploaded_by": user.user_id,
        "notes": notes,
    }
    if analysis_status:
        photo_insert["analysis_status"] = analysis_status

    photo_row = sb.table("visit_photos").insert(photo_insert).execute()
    photo_id = photo_row.data[0]["id"]

    # --- Launch background analysis for shelf photos ---
    if category == "shelf" and analysis_id:
        asyncio.create_task(
            _analyze_in_background(
                image_bytes=image_bytes,
                content_type=content_type,
                analysis_id=analysis_id,
                photo_id=photo_id,
                tenant_id=tenant_id,
            )
        )

    return _row_to_photo(photo_row.data[0], sb)


async def _analyze_in_background(
    image_bytes: bytes,
    content_type: str,
    analysis_id: str,
    photo_id: str,
    tenant_id: str,
) -> None:
    """Run vision analysis in background and update DB records."""
    sb = get_supabase_client()
    try:
        # Mark as analyzing
        sb.table("analyses").update({"status": "processing"}).eq("id", analysis_id).execute()
        sb.table("visit_photos").update({"analysis_status": "analyzing"}).eq("id", photo_id).execute()

        result = await analyze_shelf_image_from_bytes(image_bytes, content_type)

        products_to_insert = [
            {
                "analysis_id": analysis_id,
                "tenant_id": tenant_id,
                "product_name": p.product_name,
                "brand": p.brand,
                "facings": p.facings,
                "price": float(p.price) if p.price is not None else None,
                "position_x": p.position_x,
                "position_y": p.position_y,
                "is_oos": p.is_oos,
                "confidence": p.confidence,
            }
            for p in result.products
        ]

        # Catalog matching
        try:
            from app.services.catalog_matcher import match_detected_products
            products_to_insert = await match_detected_products(products_to_insert, tenant_id)
        except Exception as match_err:
            logger.warning("Catalog matching failed, continuing without: %s", match_err)

        if products_to_insert:
            sb.table("detected_products").insert(products_to_insert).execute()

        sb.table("analyses").update({
            "status": "completed",
            "raw_response": result.model_dump(),
        }).eq("id", analysis_id).execute()

        sb.table("visit_photos").update({"analysis_status": "completed"}).eq("id", photo_id).execute()

    except Exception as exc:
        logger.error("Background analysis failed for %s: %s", analysis_id, exc)
        sb.table("analyses").update({
            "status": "failed",
            "raw_response": {"error": str(exc)},
        }).eq("id", analysis_id).execute()
        sb.table("visit_photos").update({"analysis_status": "failed"}).eq("id", photo_id).execute()


# ── Photo analysis status ────────────────────────────────


@router.get("/{visit_id}/photos/{photo_id}/status")
async def get_photo_analysis_status(
    visit_id: str,
    photo_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    """Get the analysis status of a specific photo."""
    sb = get_supabase_client()
    row = (
        sb.table("visit_photos")
        .select("analysis_status, analysis_id")
        .eq("id", photo_id)
        .eq("visit_id", visit_id)
        .eq("tenant_id", user.tenant_id)
        .execute()
    )
    if not row.data:
        raise HTTPException(status_code=404, detail="Photo not found")
    return {
        "analysis_status": row.data[0].get("analysis_status"),
        "analysis_id": row.data[0].get("analysis_id"),
    }


# ── List photos ───────────────────────────────────────────


@router.get("/{visit_id}/photos", response_model=VisitPhotoListOut)
async def list_visit_photos(
    visit_id: str,
    category: str | None = Query(None),
    user: CurrentUser = Depends(get_current_user),
):
    """List all photos for a visit, optionally filtered by category."""
    sb = get_supabase_client()
    _verify_visit_ownership(sb, visit_id, user.tenant_id)

    query = (
        sb.table("visit_photos")
        .select("*", count="exact")
        .eq("visit_id", visit_id)
        .eq("tenant_id", user.tenant_id)
        .order("created_at", desc=False)
    )
    if category:
        query = query.eq("category", category)

    rows = query.execute()
    total = rows.count if rows.count is not None else len(rows.data)

    return VisitPhotoListOut(
        data=[_row_to_photo(r, sb) for r in rows.data],
        total=total,
    )


# ── Delete photo ──────────────────────────────────────────


@router.delete(
    "/{visit_id}/photos/{photo_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_visit_photo(
    visit_id: str,
    photo_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    """Delete a visit photo."""
    sb = get_supabase_client()

    row = (
        sb.table("visit_photos")
        .delete()
        .eq("id", photo_id)
        .eq("visit_id", visit_id)
        .eq("tenant_id", user.tenant_id)
        .execute()
    )
    if not row.data:
        raise HTTPException(status_code=404, detail="Photo not found")


# ── Visit summary ─────────────────────────────────────────


@router.get("/{visit_id}/summary", response_model=VisitSummaryOut)
async def get_visit_summary(
    visit_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    """Get a full summary of a visit: store info, photo counts, analysis stats."""
    sb = get_supabase_client()
    visit = _verify_visit_ownership(sb, visit_id, user.tenant_id)

    # Get store info
    store_row = (
        sb.table("stores")
        .select("name, chain, address")
        .eq("id", visit["store_id"])
        .execute()
    )
    store = store_row.data[0] if store_row.data else {}

    # Get photos grouped by category
    photos_rows = (
        sb.table("visit_photos")
        .select("category, analysis_id")
        .eq("visit_id", visit_id)
        .eq("tenant_id", user.tenant_id)
        .execute()
    )

    photos_count = {"shelf": 0, "promotion": 0, "activity": 0}
    analysis_ids = []
    for p in photos_rows.data:
        cat = p["category"]
        if cat in photos_count:
            photos_count[cat] += 1
        if p.get("analysis_id"):
            analysis_ids.append(p["analysis_id"])

    # Aggregate analysis stats
    total_products = 0
    total_facings = 0
    oos_count = 0
    confidences: list[float] = []
    oos_products: list[OosProductOut] = []

    if analysis_ids:
        prods = (
            sb.table("detected_products")
            .select("product_name, brand, facings, is_oos, confidence")
            .in_("analysis_id", analysis_ids)
            .eq("tenant_id", user.tenant_id)
            .execute()
        )
        for dp in prods.data:
            total_products += 1
            total_facings += dp.get("facings", 0)
            if dp.get("is_oos"):
                oos_count += 1
                oos_products.append(OosProductOut(
                    product_name=dp["product_name"],
                    brand=dp.get("brand"),
                ))
            if dp.get("confidence") is not None:
                confidences.append(dp["confidence"])

    avg_confidence = (sum(confidences) / len(confidences)) if confidences else None

    return VisitSummaryOut(
        visit=VisitOut(
            id=visit["id"],
            tenant_id=visit["tenant_id"],
            store_id=visit["store_id"],
            user_id=visit["user_id"],
            scheduled_at=visit.get("scheduled_at"),
            started_at=visit.get("started_at"),
            ended_at=visit.get("ended_at"),
            duration_minutes=visit.get("duration_minutes"),
            status=visit["status"],
            notes=visit.get("notes"),
            created_at=visit["created_at"],
        ),
        store_name=store.get("name", ""),
        store_chain=store.get("chain"),
        store_address=store.get("address"),
        photos_count=photos_count,
        analyses_count=len(analysis_ids),
        total_products=total_products,
        total_facings=total_facings,
        oos_count=oos_count,
        avg_confidence=round(avg_confidence, 2) if avg_confidence is not None else None,
        oos_products=oos_products,
    )


# ── Consolidate analyses ──────────────────────────────────


@router.post("/{visit_id}/consolidate", response_model=AnalysisDetailOut)
async def consolidate_visit_analyses(
    visit_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    """Consolidate all shelf analyses from a visit into a single unified analysis."""
    sb = get_supabase_client()
    visit = _verify_visit_ownership(sb, visit_id, user.tenant_id)

    # Get all shelf photos with completed analyses
    photos_rows = (
        sb.table("visit_photos")
        .select("analysis_id")
        .eq("visit_id", visit_id)
        .eq("tenant_id", user.tenant_id)
        .eq("category", "shelf")
        .execute()
    )

    analysis_ids = [p["analysis_id"] for p in photos_rows.data if p.get("analysis_id")]

    if len(analysis_ids) < 2:
        raise HTTPException(status_code=400, detail="Se necesitan al menos 2 análisis completados para consolidar")

    # Check that analyses are completed
    completed = (
        sb.table("analyses")
        .select("id")
        .in_("id", analysis_ids)
        .eq("tenant_id", user.tenant_id)
        .eq("status", "completed")
        .execute()
    )
    completed_ids = [a["id"] for a in completed.data]

    if len(completed_ids) < 2:
        raise HTTPException(status_code=400, detail="Se necesitan al menos 2 análisis completados para consolidar")

    # Fetch products for each analysis
    analyses_data = []
    for aid in completed_ids:
        prods = (
            sb.table("detected_products")
            .select("product_name, brand, facings, price, position_x, position_y, is_oos, confidence")
            .eq("analysis_id", aid)
            .eq("tenant_id", user.tenant_id)
            .execute()
        )
        analyses_data.append({
            "analysis_id": aid,
            "products": prods.data,
        })

    # Run consolidation via Gemini
    result = await consolidate_analyses(analyses_data)

    # Create a new consolidated analysis record
    # Use the first shelf_upload_id as reference
    first_analysis = (
        sb.table("analyses")
        .select("shelf_upload_id")
        .eq("id", completed_ids[0])
        .execute()
    )
    shelf_upload_id = first_analysis.data[0]["shelf_upload_id"] if first_analysis.data else completed_ids[0]

    analysis_row = (
        sb.table("analyses")
        .insert({
            "tenant_id": user.tenant_id,
            "shelf_upload_id": shelf_upload_id,
            "status": "completed",
            "is_consolidated": True,
            "raw_response": result.model_dump(),
        })
        .execute()
    )
    new_analysis = analysis_row.data[0]
    new_analysis_id = new_analysis["id"]

    # Insert consolidated products
    products_to_insert = [
        {
            "analysis_id": new_analysis_id,
            "tenant_id": user.tenant_id,
            "product_name": p.product_name,
            "brand": p.brand,
            "facings": p.facings,
            "price": float(p.price) if p.price is not None else None,
            "position_x": p.position_x,
            "position_y": p.position_y,
            "is_oos": p.is_oos,
            "confidence": p.confidence,
        }
        for p in result.products
    ]

    inserted_products = []
    if products_to_insert:
        prod_rows = sb.table("detected_products").insert(products_to_insert).execute()
        inserted_products = prod_rows.data

    return AnalysisDetailOut(
        id=new_analysis_id,
        tenant_id=user.tenant_id,
        shelf_upload_id=shelf_upload_id,
        status="completed",
        created_at=new_analysis["created_at"],
        summary=result.summary,
        products=[
            DetectedProductOut(
                id=row["id"],
                product_name=row["product_name"],
                brand=row["brand"],
                facings=row["facings"],
                price=float(row["price"]) if row["price"] is not None else None,
                position_x=row["position_x"],
                position_y=row["position_y"],
                is_oos=row["is_oos"],
                confidence=row["confidence"],
                catalog_product_id=row.get("catalog_product_id"),
                is_own=row.get("is_own"),
            )
            for row in inserted_products
        ],
    )


# ── Visit CSV export ──────────────────────────────────────


@router.get("/{visit_id}/export")
async def export_visit_csv(
    visit_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    """Export all analysis results for a visit as CSV."""
    sb = get_supabase_client()
    _verify_visit_ownership(sb, visit_id, user.tenant_id)

    photos_rows = (
        sb.table("visit_photos")
        .select("analysis_id")
        .eq("visit_id", visit_id)
        .eq("tenant_id", user.tenant_id)
        .execute()
    )

    analysis_ids = [p["analysis_id"] for p in photos_rows.data if p.get("analysis_id")]

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["Analisis ID", "Producto", "Marca", "Facings", "Precio", "Pos X", "Pos Y", "OOS", "Confianza"])

    if analysis_ids:
        prods = (
            sb.table("detected_products")
            .select("*")
            .in_("analysis_id", analysis_ids)
            .eq("tenant_id", user.tenant_id)
            .execute()
        )
        for p in prods.data:
            writer.writerow([
                p.get("analysis_id", "")[:8],
                p["product_name"],
                p.get("brand") or "",
                p.get("facings", 0),
                p["price"] if p.get("price") is not None else "",
                p.get("position_x", ""),
                p.get("position_y", ""),
                "Si" if p.get("is_oos") else "No",
                p.get("confidence", ""),
            ])

    buf.seek(0)
    short_id = visit_id[:8]
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="visita_{short_id}.csv"'},
    )
