from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.deps import get_supabase_client, get_current_user, CurrentUser
from app.models.api import VisitOut, VisitListOut

router = APIRouter(prefix="/api/v1/visits", tags=["visits"])


# ── Request bodies ──────────────────────────────────────────


class VisitCreate(BaseModel):
    store_id: str
    user_id: str | None = None  # Admin can assign to a GPV; defaults to current user
    scheduled_at: str | None = None
    notes: str | None = None


class VisitUpdate(BaseModel):
    store_id: str | None = None
    scheduled_at: str | None = None
    notes: str | None = None
    status: str | None = None


# ── Helpers ─────────────────────────────────────────────────


def _row_to_out(row: dict) -> VisitOut:
    return VisitOut(
        id=row["id"],
        tenant_id=row["tenant_id"],
        store_id=row["store_id"],
        user_id=row["user_id"],
        scheduled_at=row.get("scheduled_at"),
        started_at=row.get("started_at"),
        ended_at=row.get("ended_at"),
        duration_minutes=row.get("duration_minutes"),
        status=row["status"],
        notes=row.get("notes"),
        created_at=row["created_at"],
    )


# ── Endpoints ───────────────────────────────────────────────


@router.post("/", response_model=VisitOut, status_code=201)
async def create_visit(body: VisitCreate, user: CurrentUser = Depends(get_current_user)):
    sb = get_supabase_client()

    payload = {
        "tenant_id": user.tenant_id,
        "store_id": body.store_id,
        "user_id": body.user_id or user.user_id,
        "status": "scheduled",
    }
    if body.scheduled_at:
        payload["scheduled_at"] = body.scheduled_at
    if body.notes:
        payload["notes"] = body.notes

    row = sb.table("visits").insert(payload).execute()
    return _row_to_out(row.data[0])


@router.get("/", response_model=VisitListOut)
async def list_visits(
    limit: int = Query(default=20, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    user: CurrentUser = Depends(get_current_user),
):
    sb = get_supabase_client()

    rows = (
        sb.table("visits")
        .select("*", count="exact")
        .eq("tenant_id", user.tenant_id)
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )

    total = rows.count if rows.count is not None else len(rows.data)

    return VisitListOut(
        data=[_row_to_out(r) for r in rows.data],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/{visit_id}", response_model=VisitOut)
async def get_visit(visit_id: str, user: CurrentUser = Depends(get_current_user)):
    sb = get_supabase_client()

    row = (
        sb.table("visits")
        .select("*")
        .eq("id", visit_id)
        .eq("tenant_id", user.tenant_id)
        .execute()
    )

    if not row.data:
        raise HTTPException(status_code=404, detail="Visit not found")

    return _row_to_out(row.data[0])


@router.put("/{visit_id}", response_model=VisitOut)
async def update_visit(visit_id: str, body: VisitUpdate, user: CurrentUser = Depends(get_current_user)):
    sb = get_supabase_client()

    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    row = (
        sb.table("visits")
        .update(updates)
        .eq("id", visit_id)
        .eq("tenant_id", user.tenant_id)
        .execute()
    )

    if not row.data:
        raise HTTPException(status_code=404, detail="Visit not found")

    return _row_to_out(row.data[0])


@router.post("/{visit_id}/start", response_model=VisitOut)
async def start_visit(visit_id: str, user: CurrentUser = Depends(get_current_user)):
    sb = get_supabase_client()

    existing = (
        sb.table("visits")
        .select("*")
        .eq("id", visit_id)
        .eq("tenant_id", user.tenant_id)
        .execute()
    )

    if not existing.data:
        raise HTTPException(status_code=404, detail="Visit not found")

    visit = existing.data[0]
    if visit["status"] != "scheduled":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot start visit with status '{visit['status']}'. Must be 'scheduled'.",
        )

    now = datetime.now(timezone.utc).isoformat()
    row = (
        sb.table("visits")
        .update({"status": "in_progress", "started_at": now})
        .eq("id", visit_id)
        .eq("tenant_id", user.tenant_id)
        .execute()
    )

    return _row_to_out(row.data[0])


@router.post("/{visit_id}/end", response_model=VisitOut)
async def end_visit(visit_id: str, user: CurrentUser = Depends(get_current_user)):
    sb = get_supabase_client()

    existing = (
        sb.table("visits")
        .select("*")
        .eq("id", visit_id)
        .eq("tenant_id", user.tenant_id)
        .execute()
    )

    if not existing.data:
        raise HTTPException(status_code=404, detail="Visit not found")

    visit = existing.data[0]
    if visit["status"] != "in_progress":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot end visit with status '{visit['status']}'. Must be 'in_progress'.",
        )

    now = datetime.now(timezone.utc)
    duration = None
    if visit.get("started_at"):
        started = datetime.fromisoformat(visit["started_at"])
        duration = int((now - started).total_seconds() / 60)

    row = (
        sb.table("visits")
        .update({
            "status": "completed",
            "ended_at": now.isoformat(),
            "duration_minutes": duration,
        })
        .eq("id", visit_id)
        .eq("tenant_id", user.tenant_id)
        .execute()
    )

    return _row_to_out(row.data[0])


@router.delete("/{visit_id}", status_code=204)
async def delete_visit(visit_id: str, user: CurrentUser = Depends(get_current_user)):
    sb = get_supabase_client()

    row = (
        sb.table("visits")
        .delete()
        .eq("id", visit_id)
        .eq("tenant_id", user.tenant_id)
        .execute()
    )

    if not row.data:
        raise HTTPException(status_code=404, detail="Visit not found")
