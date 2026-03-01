import uuid
from fastapi import APIRouter, Depends, File, Form, UploadFile, HTTPException, Query

from app.config import settings
from app.deps import get_supabase_client, get_current_user, CurrentUser
from app.services.vision import analyze_shelf_image_from_bytes
from app.models.api import (
    AnalysisUploadOut,
    AnalysisDetailOut,
    AnalysisListOut,
    AnalysisOut,
    ShelfUploadOut,
    DetectedProductOut,
)

router = APIRouter(prefix="/api/v1/analyses", tags=["analyses"])

BUCKET_NAME = "shelf-images"


def _ensure_bucket(sb):
    """Create the storage bucket if it doesn't exist."""
    try:
        sb.storage.get_bucket(BUCKET_NAME)
    except Exception:
        sb.storage.create_bucket(BUCKET_NAME, options={"public": False})


@router.post("/upload", response_model=AnalysisUploadOut)
async def upload_and_analyze(
    file: UploadFile = File(...),
    store_id: str = Form(...),
    user: CurrentUser = Depends(get_current_user),
):
    """Upload a shelf image, run AI analysis, and return results."""
    tenant_id = user.tenant_id
    user_id = user.user_id

    sb = get_supabase_client()
    _ensure_bucket(sb)

    # --- 1. Upload image to Supabase Storage ---
    image_bytes = await file.read()
    content_type = file.content_type or "image/jpeg"
    ext = content_type.split("/")[-1].replace("jpeg", "jpg")
    upload_id = str(uuid.uuid4())
    storage_path = f"{tenant_id}/{upload_id}.{ext}"

    sb.storage.from_(BUCKET_NAME).upload(
        path=storage_path,
        file=image_bytes,
        file_options={"content-type": content_type},
    )

    image_url = f"{settings.supabase_url}/storage/v1/object/{BUCKET_NAME}/{storage_path}"

    # --- 2. Insert shelf_uploads record ---
    upload_row = (
        sb.table("shelf_uploads")
        .insert(
            {
                "tenant_id": tenant_id,
                "store_id": store_id,
                "image_url": image_url,
                "uploaded_by": user_id,
            }
        )
        .execute()
    )
    shelf_upload = upload_row.data[0]

    # --- 3. Insert analyses record (pending) ---
    analysis_row = (
        sb.table("analyses")
        .insert(
            {
                "tenant_id": tenant_id,
                "shelf_upload_id": shelf_upload["id"],
                "status": "processing",
            }
        )
        .execute()
    )
    analysis = analysis_row.data[0]
    analysis_id = analysis["id"]

    # --- 4. Run vision analysis ---
    try:
        result = await analyze_shelf_image_from_bytes(image_bytes, content_type)

        # --- 5. Insert detected_products ---
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

        inserted_products = []
        if products_to_insert:
            prod_rows = (
                sb.table("detected_products").insert(products_to_insert).execute()
            )
            inserted_products = prod_rows.data

        # --- 6. Update analysis to completed with raw_response ---
        sb.table("analyses").update(
            {
                "status": "completed",
                "raw_response": result.model_dump(),
            }
        ).eq("id", analysis_id).execute()

        analysis["status"] = "completed"

    except Exception as exc:
        sb.table("analyses").update(
            {"status": "failed", "raw_response": {"error": str(exc)}}
        ).eq("id", analysis_id).execute()
        raise HTTPException(status_code=500, detail=f"Analysis failed: {exc}")

    # --- 7. Build response ---
    return AnalysisUploadOut(
        upload=ShelfUploadOut(
            id=shelf_upload["id"],
            tenant_id=shelf_upload["tenant_id"],
            store_id=shelf_upload["store_id"],
            image_url=shelf_upload["image_url"],
            uploaded_by=shelf_upload["uploaded_by"],
            created_at=shelf_upload["created_at"],
        ),
        analysis=AnalysisDetailOut(
            id=analysis_id,
            tenant_id=analysis["tenant_id"],
            shelf_upload_id=analysis["shelf_upload_id"],
            status="completed",
            created_at=analysis["created_at"],
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
                )
                for row in inserted_products
            ],
        ),
    )


@router.get("/{analysis_id}", response_model=AnalysisDetailOut)
async def get_analysis(analysis_id: str, user: CurrentUser = Depends(get_current_user)):
    """Get a single analysis with all its detected products."""
    sb = get_supabase_client()

    row = (
        sb.table("analyses")
        .select("*")
        .eq("id", analysis_id)
        .eq("tenant_id", user.tenant_id)
        .execute()
    )

    if not row.data:
        raise HTTPException(status_code=404, detail="Analysis not found")

    analysis = row.data[0]

    prod_rows = (
        sb.table("detected_products")
        .select("*")
        .eq("analysis_id", analysis_id)
        .eq("tenant_id", user.tenant_id)
        .execute()
    )

    raw = analysis.get("raw_response") or {}
    summary = raw.get("summary")

    return AnalysisDetailOut(
        id=analysis["id"],
        tenant_id=analysis["tenant_id"],
        shelf_upload_id=analysis["shelf_upload_id"],
        status=analysis["status"],
        created_at=analysis["created_at"],
        summary=summary,
        products=[
            DetectedProductOut(
                id=p["id"],
                product_name=p["product_name"],
                brand=p["brand"],
                facings=p["facings"],
                price=float(p["price"]) if p["price"] is not None else None,
                position_x=p["position_x"],
                position_y=p["position_y"],
                is_oos=p["is_oos"],
                confidence=p["confidence"],
            )
            for p in prod_rows.data
        ],
    )


@router.get("/", response_model=AnalysisListOut)
async def list_analyses(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: CurrentUser = Depends(get_current_user),
):
    """List analyses for the current tenant with pagination."""
    sb = get_supabase_client()

    rows = (
        sb.table("analyses")
        .select("*", count="exact")
        .eq("tenant_id", user.tenant_id)
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )

    total = rows.count if rows.count is not None else len(rows.data)

    return AnalysisListOut(
        data=[
            AnalysisOut(
                id=a["id"],
                tenant_id=a["tenant_id"],
                shelf_upload_id=a["shelf_upload_id"],
                status=a["status"],
                created_at=a["created_at"],
            )
            for a in rows.data
        ],
        total=total,
        limit=limit,
        offset=offset,
    )
