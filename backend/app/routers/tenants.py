"""Tenant management endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.deps import (
    CurrentUser,
    get_current_user,
    get_supabase_client,
    require_admin,
    require_super_admin,
)
from app.models.tenant import (
    TenantCreate,
    TenantDetailOut,
    TenantListOut,
    TenantOut,
    TenantStatsOut,
    TenantUpdate,
)

router = APIRouter(prefix="/api/v1/tenants", tags=["tenants"])

# Fields to select from tenants table (avoid SELECT *)
_TENANT_FIELDS = (
    "id, name, plan, logo_url, contact_name, contact_email, contact_phone, "
    "sector, address, tax_id, max_users, max_stores, is_active, notes, "
    "created_at, updated_at"
)

# Fields that only super_admin can change
_SUPER_ADMIN_ONLY_FIELDS = {"plan", "max_users", "max_stores", "is_active"}


def _count(table: str, tenant_id: str) -> int:
    """Count rows in a table filtered by tenant_id."""
    sb = get_supabase_client()
    resp = sb.table(table).select("id", count="exact").eq("tenant_id", tenant_id).execute()
    return resp.count or 0


def _build_detail(row: dict) -> dict:
    """Add current_users and current_stores counts to a tenant row."""
    tid = row["id"]
    return {**row, "current_users": _count("users", tid), "current_stores": _count("stores", tid)}


# ── POST / — create tenant (super_admin) ─────────────────


@router.post("/", response_model=TenantOut, status_code=status.HTTP_201_CREATED)
async def create_tenant(
    body: TenantCreate,
    admin: CurrentUser = Depends(require_super_admin),
):
    sb = get_supabase_client()
    payload = body.model_dump(exclude_none=True)
    result = sb.table("tenants").insert(payload).execute()
    if not result.data:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Failed to create tenant")
    return result.data[0]


# ── GET / — list tenants (super_admin) ────────────────────


@router.get("/", response_model=TenantListOut)
async def list_tenants(
    admin: CurrentUser = Depends(require_super_admin),
    is_active: bool | None = Query(None),
    search: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    sb = get_supabase_client()
    query = sb.table("tenants").select(_TENANT_FIELDS, count="exact")

    if is_active is not None:
        query = query.eq("is_active", is_active)
    if search:
        query = query.ilike("name", f"%{search}%")

    query = query.order("created_at", desc=True).range(offset, offset + limit - 1)
    result = query.execute()

    data = [_build_detail(row) for row in (result.data or [])]
    return TenantListOut(data=data, total=result.count or 0, limit=limit, offset=offset)


# ── GET /me — own tenant (any authenticated) ─────────────


@router.get("/me", response_model=TenantDetailOut)
async def get_my_tenant(
    user: CurrentUser = Depends(get_current_user),
):
    sb = get_supabase_client()
    result = sb.table("tenants").select(_TENANT_FIELDS).eq("id", user.tenant_id).execute()
    if not result.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tenant not found")
    return _build_detail(result.data[0])


# ── GET /{id} — get tenant ────────────────────────────────


@router.get("/{tenant_id}", response_model=TenantDetailOut)
async def get_tenant(
    tenant_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    # Non-super_admin can only see their own tenant
    if user.role != "super_admin" and user.tenant_id != tenant_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Access denied")

    sb = get_supabase_client()
    result = sb.table("tenants").select(_TENANT_FIELDS).eq("id", tenant_id).execute()
    if not result.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tenant not found")
    return _build_detail(result.data[0])


# ── PUT /{id} — update tenant ─────────────────────────────


@router.put("/{tenant_id}", response_model=TenantOut)
async def update_tenant(
    tenant_id: str,
    body: TenantUpdate,
    user: CurrentUser = Depends(get_current_user),
):
    is_super = user.role == "super_admin"

    # Non-super_admin can only edit their own tenant
    if not is_super and user.tenant_id != tenant_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Access denied")

    # Must be at least admin
    if user.role not in ("admin", "super_admin"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin access required")

    payload = body.model_dump(exclude_none=True)
    if not payload:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No fields to update")

    # Non-super_admin cannot change restricted fields
    if not is_super:
        restricted = set(payload.keys()) & _SUPER_ADMIN_ONLY_FIELDS
        if restricted:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                f"Cannot modify: {', '.join(restricted)}",
            )

    sb = get_supabase_client()
    result = sb.table("tenants").update(payload).eq("id", tenant_id).execute()
    if not result.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tenant not found")
    return result.data[0]


# ── POST /{id}/deactivate — soft-delete (super_admin) ────


@router.post("/{tenant_id}/deactivate", response_model=TenantOut)
async def deactivate_tenant(
    tenant_id: str,
    admin: CurrentUser = Depends(require_super_admin),
):
    sb = get_supabase_client()
    result = sb.table("tenants").update({"is_active": False}).eq("id", tenant_id).execute()
    if not result.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tenant not found")
    return result.data[0]


# ── POST /{id}/activate — reactivate (super_admin) ───────


@router.post("/{tenant_id}/activate", response_model=TenantOut)
async def activate_tenant(
    tenant_id: str,
    admin: CurrentUser = Depends(require_super_admin),
):
    sb = get_supabase_client()
    result = sb.table("tenants").update({"is_active": True}).eq("id", tenant_id).execute()
    if not result.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tenant not found")
    return result.data[0]


# ── DELETE /{id} — hard delete (super_admin) ──────────────


@router.delete("/{tenant_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tenant(
    tenant_id: str,
    admin: CurrentUser = Depends(require_super_admin),
):
    if admin.tenant_id == tenant_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot delete your own tenant")

    sb = get_supabase_client()
    result = sb.table("tenants").delete().eq("id", tenant_id).execute()
    if not result.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tenant not found")


# ── GET /{id}/stats — tenant statistics ───────────────────


@router.get("/{tenant_id}/stats", response_model=TenantStatsOut)
async def get_tenant_stats(
    tenant_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    if user.role != "super_admin" and user.tenant_id != tenant_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Access denied")

    # Must be at least admin
    if user.role not in ("admin", "super_admin"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin access required")

    sb = get_supabase_client()
    tenant = sb.table("tenants").select("id, name, max_users, max_stores").eq("id", tenant_id).execute()
    if not tenant.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tenant not found")

    t = tenant.data[0]
    users = _count("users", tenant_id)
    stores = _count("stores", tenant_id)
    visits = _count("visits", tenant_id)
    analyses = _count("analyses", tenant_id)

    max_u = t.get("max_users", 50)
    max_s = t.get("max_stores", 200)

    return TenantStatsOut(
        tenant_id=t["id"],
        tenant_name=t["name"],
        users=users,
        users_limit=max_u,
        users_pct=round(users / max_u * 100, 1) if max_u > 0 else 0,
        stores=stores,
        stores_limit=max_s,
        stores_pct=round(stores / max_s * 100, 1) if max_s > 0 else 0,
        visits=visits,
        analyses=analyses,
    )
