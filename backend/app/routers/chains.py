from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.config import settings
from app.deps import get_supabase_client
from app.models.api import ChainOut, ChainListOut

router = APIRouter(prefix="/api/v1/chains", tags=["chains"])


# ── Request bodies ──────────────────────────────────────────


class ChainCreate(BaseModel):
    name: str
    logo_url: str | None = None
    website: str | None = None
    country: str | None = None


class ChainUpdate(BaseModel):
    name: str | None = None
    logo_url: str | None = None
    website: str | None = None
    country: str | None = None


# ── Helpers ─────────────────────────────────────────────────


def _row_to_out(row: dict) -> ChainOut:
    return ChainOut(
        id=row["id"],
        tenant_id=row["tenant_id"],
        name=row["name"],
        logo_url=row.get("logo_url"),
        website=row.get("website"),
        country=row.get("country"),
        created_at=row["created_at"],
    )


# ── Endpoints ───────────────────────────────────────────────


@router.post("/", response_model=ChainOut, status_code=201)
async def create_chain(body: ChainCreate):
    tenant_id = settings.mvp_tenant_id
    sb = get_supabase_client()

    row = (
        sb.table("chains")
        .insert({"tenant_id": tenant_id, **body.model_dump(exclude_none=True)})
        .execute()
    )
    return _row_to_out(row.data[0])


@router.get("/", response_model=ChainListOut)
async def list_chains(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    tenant_id = settings.mvp_tenant_id
    sb = get_supabase_client()

    rows = (
        sb.table("chains")
        .select("*", count="exact")
        .eq("tenant_id", tenant_id)
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )

    total = rows.count if rows.count is not None else len(rows.data)

    return ChainListOut(
        data=[_row_to_out(r) for r in rows.data],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/{chain_id}", response_model=ChainOut)
async def get_chain(chain_id: str):
    tenant_id = settings.mvp_tenant_id
    sb = get_supabase_client()

    row = (
        sb.table("chains")
        .select("*")
        .eq("id", chain_id)
        .eq("tenant_id", tenant_id)
        .execute()
    )

    if not row.data:
        raise HTTPException(status_code=404, detail="Chain not found")

    return _row_to_out(row.data[0])


@router.put("/{chain_id}", response_model=ChainOut)
async def update_chain(chain_id: str, body: ChainUpdate):
    tenant_id = settings.mvp_tenant_id
    sb = get_supabase_client()

    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    row = (
        sb.table("chains")
        .update(updates)
        .eq("id", chain_id)
        .eq("tenant_id", tenant_id)
        .execute()
    )

    if not row.data:
        raise HTTPException(status_code=404, detail="Chain not found")

    return _row_to_out(row.data[0])


@router.delete("/{chain_id}", status_code=204)
async def delete_chain(chain_id: str):
    tenant_id = settings.mvp_tenant_id
    sb = get_supabase_client()

    row = (
        sb.table("chains")
        .delete()
        .eq("id", chain_id)
        .eq("tenant_id", tenant_id)
        .execute()
    )

    if not row.data:
        raise HTTPException(status_code=404, detail="Chain not found")
