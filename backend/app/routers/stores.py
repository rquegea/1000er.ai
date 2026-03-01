from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.deps import get_supabase_client, get_current_user, require_admin, CurrentUser
from app.models.api import StoreCreate, StoreUpdate, StoreOut, StoreListOut

router = APIRouter(prefix="/api/v1/stores", tags=["stores"])


def _row_to_out(row: dict) -> StoreOut:
    return StoreOut(
        id=row["id"],
        tenant_id=row["tenant_id"],
        name=row["name"],
        address=row.get("address"),
        chain=row.get("chain"),
        responsible_user_id=row.get("responsible_user_id"),
        key_account_id=row.get("key_account_id"),
        contact_name=row.get("contact_name"),
        phone_section_manager=row.get("phone_section_manager"),
        email_section_manager=row.get("email_section_manager"),
        phone_sector_manager=row.get("phone_sector_manager"),
        email_sector_manager=row.get("email_sector_manager"),
        region=row.get("region"),
        area=row.get("area"),
        latitude=row.get("latitude"),
        longitude=row.get("longitude"),
        created_at=row["created_at"],
    )


@router.post("/", response_model=StoreOut, status_code=status.HTTP_201_CREATED)
async def create_store(
    body: StoreCreate,
    admin: CurrentUser = Depends(require_admin),
):
    """Create a new store (admin only)."""
    sb = get_supabase_client()

    payload = {"tenant_id": admin.tenant_id, "name": body.name}
    for field in (
        "address", "chain", "responsible_user_id", "key_account_id",
        "contact_name", "phone_section_manager", "email_section_manager",
        "phone_sector_manager", "email_sector_manager",
        "region", "area", "latitude", "longitude",
    ):
        val = getattr(body, field)
        if val is not None:
            payload[field] = val

    row = sb.table("stores").insert(payload).execute()
    return _row_to_out(row.data[0])


@router.get("/", response_model=StoreListOut)
async def list_stores(
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    user: CurrentUser = Depends(get_current_user),
):
    """List stores for the current tenant with pagination."""
    sb = get_supabase_client()

    rows = (
        sb.table("stores")
        .select("*", count="exact")
        .eq("tenant_id", user.tenant_id)
        .order("name")
        .range(offset, offset + limit - 1)
        .execute()
    )

    total = rows.count if rows.count is not None else len(rows.data)
    return StoreListOut(
        data=[_row_to_out(r) for r in rows.data],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/{store_id}", response_model=StoreOut)
async def get_store(
    store_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    """Get a single store by ID."""
    sb = get_supabase_client()

    row = (
        sb.table("stores")
        .select("*")
        .eq("id", store_id)
        .eq("tenant_id", user.tenant_id)
        .execute()
    )
    if not row.data:
        raise HTTPException(status_code=404, detail="Store not found")

    return _row_to_out(row.data[0])


@router.put("/{store_id}", response_model=StoreOut)
async def update_store(
    store_id: str,
    body: StoreUpdate,
    admin: CurrentUser = Depends(require_admin),
):
    """Update a store (admin only)."""
    sb = get_supabase_client()

    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    row = (
        sb.table("stores")
        .update(updates)
        .eq("id", store_id)
        .eq("tenant_id", admin.tenant_id)
        .execute()
    )
    if not row.data:
        raise HTTPException(status_code=404, detail="Store not found")

    return _row_to_out(row.data[0])


@router.delete("/{store_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_store(
    store_id: str,
    admin: CurrentUser = Depends(require_admin),
):
    """Delete a store (admin only)."""
    sb = get_supabase_client()

    row = (
        sb.table("stores")
        .delete()
        .eq("id", store_id)
        .eq("tenant_id", admin.tenant_id)
        .execute()
    )
    if not row.data:
        raise HTTPException(status_code=404, detail="Store not found")
