import jwt
from jwt import PyJWKClient
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import create_client, Client

from app.config import settings

# ── Supabase client ────────────────────────────────────────


def get_supabase_client() -> Client:
    return create_client(settings.supabase_url, settings.supabase_service_key)


# ── JWT auth ───────────────────────────────────────────────

security = HTTPBearer()

jwks_client = PyJWKClient(f"{settings.supabase_url}/auth/v1/.well-known/jwks.json")


class CurrentUser:
    def __init__(self, tenant_id: str, user_id: str, role: str):
        self.tenant_id = tenant_id
        self.user_id = user_id
        self.role = role


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> CurrentUser:
    token = credentials.credentials
    try:
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256"],
            audience="authenticated",
        )
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing user_id in token",
        )

    tenant_id = (payload.get("app_metadata") or {}).get("tenant_id")

    # Always query users table to get role (and tenant_id as fallback)
    sb = get_supabase_client()
    row = sb.table("users").select("tenant_id, role").eq("id", user_id).execute()

    if not row.data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found in database",
        )

    user_row = row.data[0]
    role = user_row.get("role", "analyst")

    if not tenant_id:
        tenant_id = user_row.get("tenant_id")

    if not tenant_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing tenant_id for user",
        )

    return CurrentUser(tenant_id=tenant_id, user_id=user_id, role=role)


async def require_admin(
    user: CurrentUser = Depends(get_current_user),
) -> CurrentUser:
    if user.role not in ("admin", "super_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return user


async def require_super_admin(
    user: CurrentUser = Depends(get_current_user),
) -> CurrentUser:
    if user.role != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super admin access required",
        )
    return user
