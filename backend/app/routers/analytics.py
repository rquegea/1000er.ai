from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.deps import get_supabase_client, get_current_user, CurrentUser

router = APIRouter(prefix="/api/v1/analytics", tags=["analytics"])


class ShareOfShelf(BaseModel):
    own_facings: int = 0
    competitor_facings: int = 0
    unknown_facings: int = 0
    own_share_pct: float = 0.0


class AnalyticsStoreData(BaseModel):
    id: str
    name: str
    chain: str | None = None
    lat: float | None = None
    lng: float | None = None
    total_facings: int = 0
    oos_count: int = 0
    oos_rate: float = 0.0
    brand_share: float = 0.0
    last_visit: str | None = None
    share_of_shelf: ShareOfShelf | None = None


class AnalyticsTrendPoint(BaseModel):
    date: str
    analyses_count: int = 0
    total_facings: int = 0
    oos_rate: float = 0.0
    brand_share: float = 0.0


class AnalyticsSummary(BaseModel):
    total_analyses: int = 0
    total_products: int = 0
    total_facings: int = 0
    total_oos: int = 0
    avg_confidence: float | None = None
    stores: list[AnalyticsStoreData] = []
    trend: list[AnalyticsTrendPoint] = []
    chains: list[str] = []
    share_of_shelf: ShareOfShelf | None = None


@router.get("/summary", response_model=AnalyticsSummary)
async def get_analytics_summary(
    days: int = Query(default=30, ge=1, le=365),
    chain: str | None = Query(default=None),
    store_id: str | None = Query(default=None),
    user: CurrentUser = Depends(get_current_user),
):
    """Get analytics summary with real data from analyses."""
    sb = get_supabase_client()
    tenant_id = user.tenant_id
    since = (datetime.utcnow() - timedelta(days=days)).isoformat()

    # Fetch completed analyses in date range
    analyses_query = (
        sb.table("analyses")
        .select("id, shelf_upload_id, created_at")
        .eq("tenant_id", tenant_id)
        .eq("status", "completed")
        .gte("created_at", since)
        .order("created_at", desc=False)
    )
    analyses_rows = analyses_query.execute()
    analyses = analyses_rows.data

    if not analyses:
        # Return empty summary
        stores_rows = sb.table("stores").select("id, name, chain").eq("tenant_id", tenant_id).execute()
        chains = list(set(s["chain"] for s in stores_rows.data if s.get("chain")))
        return AnalyticsSummary(chains=sorted(chains))

    analysis_ids = [a["id"] for a in analyses]
    upload_ids = list(set(a["shelf_upload_id"] for a in analyses))

    # Fetch all detected products for these analyses
    all_products: list[dict] = []
    # Supabase .in_() has a limit, batch if needed
    for i in range(0, len(analysis_ids), 100):
        batch = analysis_ids[i:i+100]
        prods = (
            sb.table("detected_products")
            .select("analysis_id, product_name, brand, facings, is_oos, confidence, is_own")
            .in_("analysis_id", batch)
            .eq("tenant_id", tenant_id)
            .execute()
        )
        all_products.extend(prods.data)

    # Fetch shelf_uploads to map to store_id
    upload_store_map: dict[str, str] = {}
    for i in range(0, len(upload_ids), 100):
        batch = upload_ids[i:i+100]
        uploads = (
            sb.table("shelf_uploads")
            .select("id, store_id")
            .in_("id", batch)
            .eq("tenant_id", tenant_id)
            .execute()
        )
        for u in uploads.data:
            upload_store_map[u["id"]] = u["store_id"]

    # Fetch stores
    stores_rows = sb.table("stores").select("id, name, chain, latitude, longitude").eq("tenant_id", tenant_id).execute()
    stores_by_id = {s["id"]: s for s in stores_rows.data}

    # Filter by chain / store_id
    if chain:
        valid_store_ids = {s["id"] for s in stores_rows.data if s.get("chain") == chain}
    elif store_id:
        valid_store_ids = {store_id}
    else:
        valid_store_ids = None  # no filter

    # Map analysis -> store_id
    analysis_store: dict[str, str] = {}
    for a in analyses:
        sid = upload_store_map.get(a["shelf_upload_id"])
        if sid:
            analysis_store[a["id"]] = sid

    # Filter analyses if chain/store filter
    if valid_store_ids is not None:
        filtered_analysis_ids = {aid for aid, sid in analysis_store.items() if sid in valid_store_ids}
    else:
        filtered_analysis_ids = set(analysis_ids)

    # Aggregate
    total_products = 0
    total_facings = 0
    total_oos = 0
    confidences: list[float] = []

    # Share of shelf tracking (global)
    own_facings_total = 0
    competitor_facings_total = 0
    unknown_facings_total = 0

    # Per-store aggregation
    store_facings: dict[str, int] = {}
    store_oos: dict[str, int] = {}
    store_products: dict[str, int] = {}
    store_own_facings: dict[str, int] = {}
    store_comp_facings: dict[str, int] = {}
    store_unk_facings: dict[str, int] = {}

    # Per-date aggregation
    date_data: dict[str, dict] = {}

    for p in all_products:
        if p["analysis_id"] not in filtered_analysis_ids:
            continue

        total_products += 1
        facings = p.get("facings", 0)
        total_facings += facings
        is_oos = p.get("is_oos", False)
        if is_oos:
            total_oos += 1
        if p.get("confidence") is not None:
            confidences.append(p["confidence"])

        # Share of shelf
        p_is_own = p.get("is_own")
        if p_is_own is True:
            own_facings_total += facings
        elif p_is_own is False:
            competitor_facings_total += facings
        else:
            unknown_facings_total += facings

        sid = analysis_store.get(p["analysis_id"])
        if sid:
            store_facings[sid] = store_facings.get(sid, 0) + facings
            store_oos[sid] = store_oos.get(sid, 0) + (1 if is_oos else 0)
            store_products[sid] = store_products.get(sid, 0) + 1
            if p_is_own is True:
                store_own_facings[sid] = store_own_facings.get(sid, 0) + facings
            elif p_is_own is False:
                store_comp_facings[sid] = store_comp_facings.get(sid, 0) + facings
            else:
                store_unk_facings[sid] = store_unk_facings.get(sid, 0) + facings

    # Build per-date trend
    for a in analyses:
        if a["id"] not in filtered_analysis_ids:
            continue
        date_key = a["created_at"][:10]  # YYYY-MM-DD
        if date_key not in date_data:
            date_data[date_key] = {"count": 0, "facings": 0, "oos": 0, "products": 0}
        date_data[date_key]["count"] += 1

    for p in all_products:
        if p["analysis_id"] not in filtered_analysis_ids:
            continue
        # Find analysis date
        for a in analyses:
            if a["id"] == p["analysis_id"]:
                date_key = a["created_at"][:10]
                if date_key in date_data:
                    date_data[date_key]["facings"] += p.get("facings", 0)
                    date_data[date_key]["products"] += 1
                    if p.get("is_oos"):
                        date_data[date_key]["oos"] += 1
                break

    trend = []
    for date_key in sorted(date_data.keys()):
        d = date_data[date_key]
        oos_rate = (d["oos"] / d["products"] * 100) if d["products"] > 0 else 0
        trend.append(AnalyticsTrendPoint(
            date=date_key,
            analyses_count=d["count"],
            total_facings=d["facings"],
            oos_rate=round(oos_rate, 1),
            brand_share=0,  # Requires brand-specific config
        ))

    # Fetch latest visit per store
    store_last_visit: dict[str, str] = {}
    visits_rows = (
        sb.table("visits")
        .select("store_id, scheduled_at")
        .eq("tenant_id", tenant_id)
        .eq("status", "completed")
        .order("scheduled_at", desc=True)
        .execute()
    )
    for v in visits_rows.data:
        sid = v["store_id"]
        if sid not in store_last_visit and v.get("scheduled_at"):
            store_last_visit[sid] = v["scheduled_at"]

    # Build store data
    stores_data = []
    for sid in set(store_facings.keys()) | set(store_oos.keys()):
        store = stores_by_id.get(sid)
        if not store:
            continue
        if valid_store_ids is not None and sid not in valid_store_ids:
            continue
        s_facings = store_facings.get(sid, 0)
        s_oos = store_oos.get(sid, 0)
        s_products = store_products.get(sid, 0)
        oos_rate = (s_oos / s_products * 100) if s_products > 0 else 0

        s_own = store_own_facings.get(sid, 0)
        s_comp = store_comp_facings.get(sid, 0)
        s_unk = store_unk_facings.get(sid, 0)
        s_total_f = s_own + s_comp + s_unk
        store_sos = ShareOfShelf(
            own_facings=s_own,
            competitor_facings=s_comp,
            unknown_facings=s_unk,
            own_share_pct=round(s_own / s_total_f * 100, 1) if s_total_f > 0 else 0.0,
        ) if s_total_f > 0 else None

        stores_data.append(AnalyticsStoreData(
            id=sid,
            name=store["name"],
            chain=store.get("chain"),
            lat=store.get("latitude"),
            lng=store.get("longitude"),
            total_facings=s_facings,
            oos_count=s_oos,
            oos_rate=round(oos_rate, 1),
            brand_share=round(s_own / s_total_f * 100, 1) if s_total_f > 0 else 0.0,
            last_visit=store_last_visit.get(sid),
            share_of_shelf=store_sos,
        ))

    chains = sorted(set(s.get("chain") for s in stores_rows.data if s.get("chain")))

    avg_conf = (sum(confidences) / len(confidences)) if confidences else None

    # Global share of shelf
    total_sos_facings = own_facings_total + competitor_facings_total + unknown_facings_total
    global_sos = ShareOfShelf(
        own_facings=own_facings_total,
        competitor_facings=competitor_facings_total,
        unknown_facings=unknown_facings_total,
        own_share_pct=round(own_facings_total / total_sos_facings * 100, 1) if total_sos_facings > 0 else 0.0,
    ) if total_sos_facings > 0 else None

    return AnalyticsSummary(
        total_analyses=len(filtered_analysis_ids),
        total_products=total_products,
        total_facings=total_facings,
        total_oos=total_oos,
        avg_confidence=round(avg_conf, 2) if avg_conf is not None else None,
        stores=stores_data,
        trend=trend,
        chains=chains,
        share_of_shelf=global_sos,
    )
