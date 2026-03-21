import logging
from rapidfuzz import fuzz

from app.deps import get_supabase_client

logger = logging.getLogger(__name__)

MATCH_THRESHOLD = 70  # minimum similarity score (0-100)


async def match_detected_products(
    products: list[dict], tenant_id: str
) -> list[dict]:
    """Match detected products against the tenant's catalog using fuzzy matching.

    For each detected product, tries to find the best match in the catalog
    by comparing product_name + brand against catalog name + brand + aliases.
    If a match is found above the threshold, sets catalog_product_id and is_own.
    """
    sb = get_supabase_client()

    # Fetch active catalog for this tenant
    catalog_rows = (
        sb.table("products")
        .select("id, name, brand, aliases, is_own")
        .eq("tenant_id", tenant_id)
        .eq("active", True)
        .execute()
    )
    catalog = catalog_rows.data

    if not catalog:
        return products

    # Build search strings for each catalog product
    catalog_entries = []
    for item in catalog:
        names = [item["name"]]
        if item.get("brand"):
            names.append(f"{item['name']} {item['brand']}")
        for alias in (item.get("aliases") or []):
            names.append(alias)
            if item.get("brand"):
                names.append(f"{alias} {item['brand']}")
        catalog_entries.append({
            "id": item["id"],
            "is_own": item.get("is_own", False),
            "search_strings": names,
        })

    # Match each detected product
    for product in products:
        detected_name = product.get("product_name", "")
        detected_brand = product.get("brand", "") or ""
        query = f"{detected_name} {detected_brand}".strip()

        best_score = 0
        best_match = None

        for entry in catalog_entries:
            for search_str in entry["search_strings"]:
                score = fuzz.token_sort_ratio(query, search_str)
                if score > best_score:
                    best_score = score
                    best_match = entry

        if best_match and best_score >= MATCH_THRESHOLD:
            product["catalog_product_id"] = best_match["id"]
            product["is_own"] = best_match["is_own"]

    return products
