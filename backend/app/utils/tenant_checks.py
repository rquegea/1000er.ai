"""Tenant validation utilities — limits and activation checks."""

from fastapi import HTTPException, status

from app.deps import get_supabase_client


def get_tenant_or_fail(tenant_id: str) -> dict:
    """Fetch a tenant row or raise 404."""
    sb = get_supabase_client()
    row = sb.table("tenants").select("*").eq("id", tenant_id).execute()
    if not row.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found",
        )
    return row.data[0]


def check_tenant_active(tenant_id: str) -> dict:
    """Fetch tenant and raise 403 if deactivated. Returns tenant row."""
    tenant = get_tenant_or_fail(tenant_id)
    if not tenant.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant is deactivated",
        )
    return tenant


def check_user_limit(tenant_id: str) -> None:
    """Raise 403 if the tenant has reached its max_users limit."""
    tenant = check_tenant_active(tenant_id)
    max_users = tenant.get("max_users", 50)

    sb = get_supabase_client()
    count_resp = (
        sb.table("users")
        .select("id", count="exact")
        .eq("tenant_id", tenant_id)
        .execute()
    )
    current = count_resp.count or 0

    if current >= max_users:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"User limit reached ({current}/{max_users})",
        )


def check_store_limit(tenant_id: str) -> None:
    """Raise 403 if the tenant has reached its max_stores limit."""
    tenant = check_tenant_active(tenant_id)
    max_stores = tenant.get("max_stores", 200)

    sb = get_supabase_client()
    count_resp = (
        sb.table("stores")
        .select("id", count="exact")
        .eq("tenant_id", tenant_id)
        .execute()
    )
    current = count_resp.count or 0

    if current >= max_stores:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Store limit reached ({current}/{max_stores})",
        )
