from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.deps import get_supabase_client, get_current_user, require_admin, CurrentUser
from app.models.api import UserCreate, UserUpdate, UserOut, UserListOut

router = APIRouter(prefix="/api/v1/users", tags=["users"])


def _row_to_user_out(row: dict) -> UserOut:
    return UserOut(
        id=row["id"],
        tenant_id=row["tenant_id"],
        email=row["email"],
        role=row["role"],
        first_name=row.get("first_name"),
        last_name=row.get("last_name"),
        phone=row.get("phone"),
        created_at=row["created_at"],
    )


@router.get("/me", response_model=UserOut)
async def get_me(user: CurrentUser = Depends(get_current_user)):
    """Return the currently authenticated user's profile."""
    sb = get_supabase_client()
    row = (
        sb.table("users")
        .select("*")
        .eq("id", user.user_id)
        .eq("tenant_id", user.tenant_id)
        .execute()
    )
    if not row.data:
        raise HTTPException(status_code=404, detail="User not found")
    return _row_to_user_out(row.data[0])


@router.get("/", response_model=UserListOut)
async def list_users(
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    user: CurrentUser = Depends(get_current_user),
):
    """List users for the current tenant with pagination."""
    sb = get_supabase_client()
    rows = (
        sb.table("users")
        .select("*", count="exact")
        .eq("tenant_id", user.tenant_id)
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    total = rows.count if rows.count is not None else len(rows.data)
    return UserListOut(
        data=[_row_to_user_out(r) for r in rows.data],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/{user_id}", response_model=UserOut)
async def get_user(
    user_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    """Get a single user by ID (same tenant)."""
    sb = get_supabase_client()
    row = (
        sb.table("users")
        .select("*")
        .eq("id", user_id)
        .eq("tenant_id", user.tenant_id)
        .execute()
    )
    if not row.data:
        raise HTTPException(status_code=404, detail="User not found")
    return _row_to_user_out(row.data[0])


@router.post("/", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user(
    body: UserCreate,
    admin: CurrentUser = Depends(require_admin),
):
    """Create a new user (admin only). Creates in Supabase Auth + users table."""
    sb = get_supabase_client()

    # 1. Create in Supabase Auth
    try:
        auth_res = sb.auth.admin.create_user(
            {
                "email": body.email,
                "password": body.password,
                "email_confirm": True,
                "app_metadata": {"tenant_id": admin.tenant_id},
            }
        )
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to create auth user: {exc}",
        )

    auth_user_id = auth_res.user.id

    # 2. Insert into users table
    try:
        row = (
            sb.table("users")
            .insert(
                {
                    "id": auth_user_id,
                    "tenant_id": admin.tenant_id,
                    "email": body.email,
                    "role": body.role,
                    "first_name": body.first_name,
                    "last_name": body.last_name,
                    "phone": body.phone,
                }
            )
            .execute()
        )
    except Exception as exc:
        # Rollback: delete the auth user we just created
        sb.auth.admin.delete_user(auth_user_id)
        raise HTTPException(
            status_code=400,
            detail=f"Failed to create user record: {exc}",
        )

    return _row_to_user_out(row.data[0])


@router.put("/{user_id}", response_model=UserOut)
async def update_user(
    user_id: str,
    body: UserUpdate,
    admin: CurrentUser = Depends(require_admin),
):
    """Update a user (admin only)."""
    sb = get_supabase_client()

    # Check user exists in this tenant
    existing = (
        sb.table("users")
        .select("*")
        .eq("id", user_id)
        .eq("tenant_id", admin.tenant_id)
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="User not found")

    # Build update payload (only non-None fields)
    update_data: dict = {}
    if body.role is not None:
        update_data["role"] = body.role
    if body.first_name is not None:
        update_data["first_name"] = body.first_name
    if body.last_name is not None:
        update_data["last_name"] = body.last_name
    if body.phone is not None:
        update_data["phone"] = body.phone
    if body.email is not None:
        update_data["email"] = body.email
        # Also update email in Supabase Auth
        try:
            sb.auth.admin.update_user_by_id(user_id, {"email": body.email})
        except Exception as exc:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to update auth email: {exc}",
            )

    if not update_data:
        return _row_to_user_out(existing.data[0])

    row = (
        sb.table("users")
        .update(update_data)
        .eq("id", user_id)
        .eq("tenant_id", admin.tenant_id)
        .execute()
    )
    return _row_to_user_out(row.data[0])


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: str,
    admin: CurrentUser = Depends(require_admin),
):
    """Delete a user (admin only). Removes from users table and Supabase Auth."""
    sb = get_supabase_client()

    # Check user exists in this tenant
    existing = (
        sb.table("users")
        .select("id")
        .eq("id", user_id)
        .eq("tenant_id", admin.tenant_id)
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="User not found")

    # Prevent self-deletion
    if user_id == admin.user_id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")

    # Delete from users table
    sb.table("users").delete().eq("id", user_id).eq(
        "tenant_id", admin.tenant_id
    ).execute()

    # Delete from Supabase Auth
    try:
        sb.auth.admin.delete_user(user_id)
    except Exception:
        pass  # Auth user may already be gone; table row is deleted
