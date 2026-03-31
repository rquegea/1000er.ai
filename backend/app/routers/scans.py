import logging
import uuid

from fastapi import APIRouter, Depends, File, Form, UploadFile, HTTPException, status

from app.config import settings
from app.deps import get_supabase_client, get_current_user, CurrentUser
from app.models.api import (
    ScanCreate,
    ScanOut,
    ScanDetailOut,
    ScanPhotoOut,
    ScanListOut,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["scans"])

BUCKET_NAME = "scan-photos"


def _ensure_bucket(sb):
    try:
        sb.storage.get_bucket(BUCKET_NAME)
    except Exception:
        sb.storage.create_bucket(BUCKET_NAME, options={"public": False})


def _signed_url(sb, image_url: str) -> str:
    """Return a 1-hour signed URL for a private-bucket image_url."""
    try:
        prefix = f"/storage/v1/object/{BUCKET_NAME}/"
        if prefix in image_url:
            storage_path = image_url.split(prefix, 1)[1]
        else:
            return image_url
        result = sb.storage.from_(BUCKET_NAME).create_signed_url(storage_path, 3600)
        return result.get("signedURL") or result.get("signed_url") or image_url
    except Exception:
        return image_url


def _verify_scan_ownership(sb, scan_id: str, tenant_id: str) -> dict:
    """Return the scan row or raise 404."""
    row = (
        sb.table("scans")
        .select("*")
        .eq("id", scan_id)
        .eq("tenant_id", tenant_id)
        .execute()
    )
    if not row.data:
        raise HTTPException(status_code=404, detail="Scan not found")
    return row.data[0]


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


def _row_to_scan(row: dict) -> ScanOut:
    return ScanOut(
        id=row["id"],
        tenant_id=row["tenant_id"],
        visit_id=row.get("visit_id"),
        store_id=row["store_id"],
        status=row["status"],
        photo_count=row.get("photo_count", 0),
        panorama_url=row.get("panorama_url"),
        analysis_id=row.get("analysis_id"),
        created_by=row["created_by"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def _row_to_photo(row: dict, sb=None) -> ScanPhotoOut:
    url = row["image_url"]
    if sb is not None:
        url = _signed_url(sb, url)
    return ScanPhotoOut(
        id=row["id"],
        scan_id=row["scan_id"],
        tenant_id=row["tenant_id"],
        photo_index=row["photo_index"],
        image_url=url,
        width=row.get("width"),
        height=row.get("height"),
        created_at=row["created_at"],
    )


# ── Create scan ──────────────────────────────────────────


@router.post(
    "/scans",
    response_model=ScanOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_scan(
    body: ScanCreate,
    user: CurrentUser = Depends(get_current_user),
):
    """Create a new scan for a visit."""
    sb = get_supabase_client()
    tenant_id = user.tenant_id

    visit = _verify_visit_ownership(sb, body.visit_id, tenant_id)

    # Validate store_id matches visit
    if visit["store_id"] != body.store_id:
        raise HTTPException(
            status_code=422,
            detail="store_id does not match the visit's store",
        )

    row = (
        sb.table("scans")
        .insert({
            "tenant_id": tenant_id,
            "visit_id": body.visit_id,
            "store_id": body.store_id,
            "status": "uploading",
            "created_by": user.user_id,
        })
        .execute()
    )

    return _row_to_scan(row.data[0])


# ── Upload photo to scan ─────────────────────────────────


@router.post(
    "/scans/{scan_id}/photos",
    response_model=ScanPhotoOut,
    status_code=status.HTTP_201_CREATED,
)
async def upload_scan_photo(
    scan_id: str,
    file: UploadFile = File(...),
    photo_index: int = Form(...),
    user: CurrentUser = Depends(get_current_user),
):
    """Upload a photo for a scan."""
    sb = get_supabase_client()
    tenant_id = user.tenant_id

    scan = _verify_scan_ownership(sb, scan_id, tenant_id)

    if scan["status"] != "uploading":
        raise HTTPException(
            status_code=422,
            detail="Scan is not in uploading status",
        )

    _ensure_bucket(sb)

    image_bytes = await file.read()
    content_type = file.content_type or "image/jpeg"
    ext = content_type.split("/")[-1].replace("jpeg", "jpg")
    file_id = str(uuid.uuid4())
    storage_path = f"{tenant_id}/{scan_id}/{file_id}.{ext}"

    sb.storage.from_(BUCKET_NAME).upload(
        path=storage_path,
        file=image_bytes,
        file_options={"content-type": content_type},
    )

    image_url = f"{settings.supabase_url}/storage/v1/object/{BUCKET_NAME}/{storage_path}"

    # Get image dimensions
    width, height = None, None
    try:
        from PIL import Image
        import io
        img = Image.open(io.BytesIO(image_bytes))
        width, height = img.size
    except Exception:
        pass

    photo_row = (
        sb.table("scan_photos")
        .insert({
            "scan_id": scan_id,
            "tenant_id": tenant_id,
            "photo_index": photo_index,
            "image_url": image_url,
            "width": width,
            "height": height,
        })
        .execute()
    )

    # Update photo_count
    sb.table("scans").update({
        "photo_count": scan["photo_count"] + 1,
        "updated_at": "now()",
    }).eq("id", scan_id).execute()

    return _row_to_photo(photo_row.data[0], sb)


# ── Process scan (placeholder) ───────────────────────────


@router.post("/scans/{scan_id}/process")
async def process_scan(
    scan_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    """Start processing a scan: stitching + analysis. (Placeholder)"""
    sb = get_supabase_client()
    tenant_id = user.tenant_id

    scan = _verify_scan_ownership(sb, scan_id, tenant_id)

    if scan["status"] != "uploading":
        raise HTTPException(
            status_code=422,
            detail="Scan is not in uploading status",
        )

    if scan["photo_count"] < 1:
        raise HTTPException(
            status_code=422,
            detail="Scan has no photos",
        )

    # Mark as stitching
    sb.table("scans").update({
        "status": "stitching",
        "updated_at": "now()",
    }).eq("id", scan_id).execute()

    # TODO: implement actual stitching + analysis pipeline
    # For now, mark as failed with a message
    sb.table("scans").update({
        "status": "failed",
        "metadata": {"error": "Scan processing not yet implemented"},
        "updated_at": "now()",
    }).eq("id", scan_id).execute()

    return {
        "scan_id": scan_id,
        "status": "failed",
        "message": "Scan processing not yet implemented",
    }


# ── Get scan detail ──────────────────────────────────────


@router.get("/scans/{scan_id}", response_model=ScanDetailOut)
async def get_scan(
    scan_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    """Get scan details including photos."""
    sb = get_supabase_client()
    scan = _verify_scan_ownership(sb, scan_id, user.tenant_id)

    photos_rows = (
        sb.table("scan_photos")
        .select("*")
        .eq("scan_id", scan_id)
        .eq("tenant_id", user.tenant_id)
        .order("photo_index")
        .execute()
    )

    panorama_url = scan.get("panorama_url")
    if panorama_url:
        panorama_url = _signed_url(sb, panorama_url)

    return ScanDetailOut(
        id=scan["id"],
        tenant_id=scan["tenant_id"],
        visit_id=scan.get("visit_id"),
        store_id=scan["store_id"],
        status=scan["status"],
        photo_count=scan.get("photo_count", 0),
        panorama_url=panorama_url,
        analysis_id=scan.get("analysis_id"),
        created_by=scan["created_by"],
        created_at=scan["created_at"],
        updated_at=scan["updated_at"],
        photos=[_row_to_photo(r, sb) for r in photos_rows.data],
    )


# ── Get panorama signed URL ──────────────────────────────


@router.get("/scans/{scan_id}/panorama")
async def get_scan_panorama(
    scan_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    """Get a signed URL for the scan panorama."""
    sb = get_supabase_client()
    scan = _verify_scan_ownership(sb, scan_id, user.tenant_id)

    if not scan.get("panorama_url"):
        raise HTTPException(status_code=404, detail="Panorama not available")

    signed = _signed_url(sb, scan["panorama_url"])
    return {"panorama_url": signed}


# ── List scans for a visit ───────────────────────────────


@router.get("/visits/{visit_id}/scans", response_model=ScanListOut)
async def list_visit_scans(
    visit_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    """List all scans for a visit."""
    sb = get_supabase_client()
    _verify_visit_ownership(sb, visit_id, user.tenant_id)

    rows = (
        sb.table("scans")
        .select("*", count="exact")
        .eq("visit_id", visit_id)
        .eq("tenant_id", user.tenant_id)
        .order("created_at", desc=False)
        .execute()
    )

    total = rows.count if rows.count is not None else len(rows.data)

    return ScanListOut(
        data=[_row_to_scan(r) for r in rows.data],
        total=total,
    )
