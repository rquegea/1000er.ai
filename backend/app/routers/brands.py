from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.config import settings
from app.deps import get_supabase_client
from app.models.api import BrandOut, BrandListOut

router = APIRouter(prefix="/api/v1/brands", tags=["brands"])


# ── Request bodies ──────────────────────────────────────────


class BrandCreate(BaseModel):
    name: str
    logo_url: str | None = None
    is_own: bool = False
    category: str | None = None


class BrandUpdate(BaseModel):
    name: str | None = None
    logo_url: str | None = None
    is_own: bool | None = None
    category: str | None = None


# ── Helpers ─────────────────────────────────────────────────


def _row_to_out(row: dict) -> BrandOut:
    return BrandOut(
        id=row["id"],
        tenant_id=row["tenant_id"],
        name=row["name"],
        logo_url=row.get("logo_url"),
        is_own=row["is_own"],
        category=row.get("category"),
        created_at=row["created_at"],
    )


# ── Endpoints ───────────────────────────────────────────────


@router.post("/", response_model=BrandOut, status_code=201)
async def create_brand(body: BrandCreate):
    tenant_id = settings.mvp_tenant_id
    sb = get_supabase_client()

    row = (
        sb.table("brands")
        .insert({"tenant_id": tenant_id, **body.model_dump(exclude_none=True)})
        .execute()
    )
    return _row_to_out(row.data[0])


@router.get("/", response_model=BrandListOut)
async def list_brands(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    tenant_id = settings.mvp_tenant_id
    sb = get_supabase_client()

    rows = (
        sb.table("brands")
        .select("*", count="exact")
        .eq("tenant_id", tenant_id)
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )

    total = rows.count if rows.count is not None else len(rows.data)

    return BrandListOut(
        data=[_row_to_out(r) for r in rows.data],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/{brand_id}", response_model=BrandOut)
async def get_brand(brand_id: str):
    tenant_id = settings.mvp_tenant_id
    sb = get_supabase_client()

    row = (
        sb.table("brands")
        .select("*")
        .eq("id", brand_id)
        .eq("tenant_id", tenant_id)
        .execute()
    )

    if not row.data:
        raise HTTPException(status_code=404, detail="Brand not found")

    return _row_to_out(row.data[0])


@router.put("/{brand_id}", response_model=BrandOut)
async def update_brand(brand_id: str, body: BrandUpdate):
    tenant_id = settings.mvp_tenant_id
    sb = get_supabase_client()

    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    row = (
        sb.table("brands")
        .update(updates)
        .eq("id", brand_id)
        .eq("tenant_id", tenant_id)
        .execute()
    )

    if not row.data:
        raise HTTPException(status_code=404, detail="Brand not found")

    return _row_to_out(row.data[0])


@router.delete("/{brand_id}", status_code=204)
async def delete_brand(brand_id: str):
    tenant_id = settings.mvp_tenant_id
    sb = get_supabase_client()

    row = (
        sb.table("brands")
        .delete()
        .eq("id", brand_id)
        .eq("tenant_id", tenant_id)
        .execute()
    )

    if not row.data:
        raise HTTPException(status_code=404, detail="Brand not found")
