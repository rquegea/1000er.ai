def test_health_still_works(test_client):
    """Sanity check: nothing is broken."""
    response = test_client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_create_scan_requires_auth(test_client):
    """POST /api/v1/scans should return 403 without auth."""
    response = test_client.post(
        "/api/v1/scans",
        json={"visit_id": "fake-visit", "store_id": "fake-store"},
    )
    assert response.status_code == 401


def test_list_visit_scans_requires_auth(test_client):
    """GET /api/v1/visits/{id}/scans should return 401 without auth."""
    response = test_client.get("/api/v1/visits/fake-id/scans")
    assert response.status_code == 401


def test_get_scan_requires_auth(test_client):
    """GET /api/v1/scans/{id} should return 401 without auth."""
    response = test_client.get("/api/v1/scans/fake-id")
    assert response.status_code == 401


def test_process_scan_requires_auth(test_client):
    """POST /api/v1/scans/{id}/process should return 401 without auth."""
    response = test_client.post("/api/v1/scans/fake-id/process")
    assert response.status_code == 401
