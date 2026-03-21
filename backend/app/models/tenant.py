"""Pydantic models for tenant management."""

from pydantic import BaseModel, EmailStr


class TenantCreate(BaseModel):
    name: str
    plan: str = "free"
    logo_url: str | None = None
    contact_name: str | None = None
    contact_email: EmailStr | None = None
    contact_phone: str | None = None
    sector: str | None = None
    address: str | None = None
    tax_id: str | None = None
    max_users: int = 50
    max_stores: int = 200
    notes: str | None = None


class TenantUpdate(BaseModel):
    name: str | None = None
    plan: str | None = None
    logo_url: str | None = None
    contact_name: str | None = None
    contact_email: EmailStr | None = None
    contact_phone: str | None = None
    sector: str | None = None
    address: str | None = None
    tax_id: str | None = None
    max_users: int | None = None
    max_stores: int | None = None
    is_active: bool | None = None
    notes: str | None = None


class TenantOut(BaseModel):
    id: str
    name: str
    plan: str
    logo_url: str | None = None
    contact_name: str | None = None
    contact_email: str | None = None
    contact_phone: str | None = None
    sector: str | None = None
    address: str | None = None
    tax_id: str | None = None
    max_users: int = 50
    max_stores: int = 200
    is_active: bool = True
    notes: str | None = None
    created_at: str
    updated_at: str | None = None


class TenantDetailOut(TenantOut):
    current_users: int = 0
    current_stores: int = 0


class TenantListOut(BaseModel):
    data: list[TenantDetailOut]
    total: int
    limit: int
    offset: int


class TenantStatsOut(BaseModel):
    tenant_id: str
    tenant_name: str
    users: int
    users_limit: int
    users_pct: float
    stores: int
    stores_limit: int
    stores_pct: float
    visits: int
    analyses: int
