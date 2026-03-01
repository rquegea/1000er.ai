import uuid
from fastapi import APIRouter, Depends, File, Form, UploadFile, HTTPException, Query, status

from app.config import settings
from app.deps import get_supabase_client, get_current_user, CurrentUser
from app.services.vision import analyze_shelf_image_from_bytes
from app.models.api import (
    VisitPhotoOut,
    VisitPhotoListOut,
    VisitSummaryOut,
    VisitOut,
    DetectedProductOut,
    OosProductOut,
)

router = APIRouter(prefix="/api/v1/visits", tags=["visit-photos"])

BUCKET_NAME = "visit-photos"


def _ensure_bucket(sb):
    try:
        sb.storage.get_bucket(BUCKET_NAME)
    except Exception:
        sb.storage.create_bucket(BUCKET_NAME, options={"public": False})


def _row_to_photo(row: dict) -> VisitPhotoOut:
    return VisitPhotoOut(
        id=row["id"],
        tenant_id=row["tenant_id"],
        visit_id=row["visit_id"],
        category=row["category"],
        image_url=row["image_url"],
        analysis_id=row.get("analysis_id"),
        uploaded_by=row["uploaded_by"],
        notes=row.get("notes"),
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

    # --- Run AI analysis for shelf photos ---
    analysis_id = None
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

        # Create analysis record
        analysis_row = (
            sb.table("analyses")
            .insert({
                "tenant_id": tenant_id,
                "shelf_upload_id": shelf_upload["id"],
                "status": "processing",
            })
            .execute()
        )
        analysis_id = analysis_row.data[0]["id"]

        try:
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

            if products_to_insert:
                sb.table("detected_products").insert(products_to_insert).execute()

            sb.table("analyses").update({
                "status": "completed",
                "raw_response": result.model_dump(),
            }).eq("id", analysis_id).execute()

        except Exception as exc:
            sb.table("analyses").update({
                "status": "failed",
                "raw_response": {"error": str(exc)},
            }).eq("id", analysis_id).execute()
            # Don't fail the whole upload — photo is saved, analysis just failed

    # --- Insert visit_photos record ---
    photo_row = (
        sb.table("visit_photos")
        .insert({
            "tenant_id": tenant_id,
            "visit_id": visit_id,
            "category": category,
            "image_url": image_url,
            "analysis_id": analysis_id,
            "uploaded_by": user.user_id,
            "notes": notes,
        })
        .execute()
    )

    return _row_to_photo(photo_row.data[0])


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
        data=[_row_to_photo(r) for r in rows.data],
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
