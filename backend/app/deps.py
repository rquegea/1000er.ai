import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import create_client, Client

from app.config import settings

# ── Supabase client ────────────────────────────────────────


def get_supabase_client() -> Client:
    return create_client(settings.supabase_url, settings.supabase_service_key)


# ── JWT auth ───────────────────────────────────────────────

security = HTTPBearer()


class CurrentUser:
    def __init__(self, tenant_id: str, user_id: str):
        self.tenant_id = tenant_id
        self.user_id = user_id


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> CurrentUser:
    token = credentials.credentials
    try:
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    user_id = payload.get("sub")
    tenant_id = (payload.get("app_metadata") or {}).get("tenant_id")

    if not tenant_id or not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing tenant_id or user_id in token",
        )

    return CurrentUser(tenant_id=tenant_id, user_id=user_id)


async def require_admin(
    user: CurrentUser = Depends(get_current_user),
) -> CurrentUser:
    sb = get_supabase_client()
    row = (
        sb.table("users")
        .select("role")
        .eq("id", user.user_id)
        .eq("tenant_id", user.tenant_id)
        .execute()
    )
    if not row.data or row.data[0]["role"] != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return user
