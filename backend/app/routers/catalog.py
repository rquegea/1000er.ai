from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.deps import get_supabase_client, get_current_user, CurrentUser
from app.models.api import (
    CatalogProductCreate,
    CatalogProductUpdate,
    CatalogProductOut,
    CatalogProductListOut,
)

router = APIRouter(prefix="/api/v1/catalog", tags=["catalog"])


def _row_to_out(row: dict) -> CatalogProductOut:
    return CatalogProductOut(
        id=row["id"],
        name=row["name"],
        brand=row.get("brand"),
        category=row.get("category"),
        is_own=row.get("is_own", False),
        ean=row.get("ean"),
        aliases=row.get("aliases") or [],
        active=row.get("active", True),
        created_at=row["created_at"],
    )


@router.get("/suggestions")
async def get_suggestions(
    user: CurrentUser = Depends(get_current_user),
):
    """Return top 20 most frequent unmatched detected products for this tenant."""
    sb = get_supabase_client()

    # Fetch all detected products without a catalog match
    rows = (
        sb.table("detected_products")
        .select("product_name, brand")
        .eq("tenant_id", user.tenant_id)
        .is_("catalog_product_id", "null")
        .execute()
    )

    if not rows.data:
        return []

    # Group by product_name + brand, count occurrences
    counts: dict[tuple[str, str], int] = {}
    for r in rows.data:
        key = (r.get("product_name") or "", r.get("brand") or "")
        counts[key] = counts.get(key, 0) + 1

    # Sort by frequency descending, take top 20
    sorted_items = sorted(counts.items(), key=lambda x: x[1], reverse=True)[:20]

    return [
        {
            "product_name": name,
            "brand": brand,
            "times_detected": count,
        }
        for (name, brand), count in sorted_items
    ]


@router.post("/products", response_model=CatalogProductOut, status_code=status.HTTP_201_CREATED)
async def create_product(
    body: CatalogProductCreate,
    user: CurrentUser = Depends(get_current_user),
):
    """Create a catalog product."""
    sb = get_supabase_client()
    payload = {
        "tenant_id": user.tenant_id,
        "name": body.name,
        "brand": body.brand,
        "is_own": body.is_own,
        "aliases": body.aliases,
    }
    if body.category is not None:
        payload["category"] = body.category
    if body.ean is not None:
        payload["ean"] = body.ean

    row = sb.table("products").insert(payload).execute()
    return _row_to_out(row.data[0])


@router.get("/products", response_model=CatalogProductListOut)
async def list_products(
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    brand: str | None = Query(default=None),
    category: str | None = Query(default=None),
    is_own: bool | None = Query(default=None),
    q: str | None = Query(default=None),
    user: CurrentUser = Depends(get_current_user),
):
    """List catalog products with filters."""
    sb = get_supabase_client()
    query = (
        sb.table("products")
        .select("*", count="exact")
        .eq("tenant_id", user.tenant_id)
        .eq("active", True)
        .order("name", desc=False)
        .range(offset, offset + limit - 1)
    )

    if brand:
        query = query.eq("brand", brand)
    if category:
        query = query.eq("category", category)
    if is_own is not None:
        query = query.eq("is_own", is_own)
    if q:
        query = query.ilike("name", f"%{q}%")

    rows = query.execute()
    total = rows.count if rows.count is not None else len(rows.data)

    return CatalogProductListOut(
        data=[_row_to_out(r) for r in rows.data],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/products/{product_id}", response_model=CatalogProductOut)
async def get_product(
    product_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    """Get a single catalog product."""
    sb = get_supabase_client()
    row = (
        sb.table("products")
        .select("*")
        .eq("id", product_id)
        .eq("tenant_id", user.tenant_id)
        .execute()
    )
    if not row.data:
        raise HTTPException(status_code=404, detail="Product not found")
    return _row_to_out(row.data[0])


@router.put("/products/{product_id}", response_model=CatalogProductOut)
async def update_product(
    product_id: str,
    body: CatalogProductUpdate,
    user: CurrentUser = Depends(get_current_user),
):
    """Update a catalog product."""
    sb = get_supabase_client()

    # Check exists
    existing = (
        sb.table("products")
        .select("id")
        .eq("id", product_id)
        .eq("tenant_id", user.tenant_id)
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Product not found")

    update_data = body.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=422, detail="No fields to update")

    row = (
        sb.table("products")
        .update(update_data)
        .eq("id", product_id)
        .eq("tenant_id", user.tenant_id)
        .execute()
    )
    return _row_to_out(row.data[0])


@router.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(
    product_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    """Soft-delete a catalog product (set active=false)."""
    sb = get_supabase_client()
    row = (
        sb.table("products")
        .update({"active": False})
        .eq("id", product_id)
        .eq("tenant_id", user.tenant_id)
        .execute()
    )
    if not row.data:
        raise HTTPException(status_code=404, detail="Product not found")


@router.post("/rematch")
async def rematch_detected_products(
    user: CurrentUser = Depends(get_current_user),
):
    """Re-match all unmatched detected_products against the current catalog."""
    from app.services.catalog_matcher import match_detected_products

    sb = get_supabase_client()

    # Fetch all detected_products without a catalog match for this tenant
    rows = (
        sb.table("detected_products")
        .select("id, product_name, brand")
        .eq("tenant_id", user.tenant_id)
        .is_("catalog_product_id", "null")
        .execute()
    )

    if not rows.data:
        return {"matched": 0, "unmatched": 0}

    # Run fuzzy matching
    products = list(rows.data)
    matched_products = await match_detected_products(products, user.tenant_id)

    # Bulk update matched ones
    matched_count = 0
    for p in matched_products:
        if p.get("catalog_product_id"):
            sb.table("detected_products").update({
                "catalog_product_id": p["catalog_product_id"],
                "is_own": p["is_own"],
            }).eq("id", p["id"]).execute()
            matched_count += 1

    unmatched_count = len(products) - matched_count
    return {"matched": matched_count, "unmatched": unmatched_count}


@router.post("/products/bulk", response_model=list[CatalogProductOut], status_code=status.HTTP_201_CREATED)
async def bulk_create_products(
    products: list[CatalogProductCreate],
    user: CurrentUser = Depends(get_current_user),
):
    """Bulk create catalog products."""
    if len(products) > 500:
        raise HTTPException(status_code=422, detail="Maximum 500 products per bulk request")

    sb = get_supabase_client()
    rows_to_insert = []
    for p in products:
        payload = {
            "tenant_id": user.tenant_id,
            "name": p.name,
            "brand": p.brand,
            "is_own": p.is_own,
            "aliases": p.aliases,
        }
        if p.category is not None:
            payload["category"] = p.category
        if p.ean is not None:
            payload["ean"] = p.ean
        rows_to_insert.append(payload)

    result = sb.table("products").insert(rows_to_insert).execute()
    return [_row_to_out(r) for r in result.data]
