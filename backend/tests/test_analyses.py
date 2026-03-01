from unittest.mock import MagicMock


def test_list_analyses_returns_list(test_client, mock_supabase):
    """GET /api/v1/analyses/ should return a paginated list."""
    # Configure the Supabase mock chain
    query = MagicMock()
    query.select.return_value = query
    query.eq.return_value = query
    query.order.return_value = query
    query.range.return_value = query
    query.execute.return_value = MagicMock(data=[], count=0)
    mock_supabase.table.return_value = query

    response = test_client.get("/api/v1/analyses/")
    assert response.status_code == 200

    body = response.json()
    assert "data" in body
    assert isinstance(body["data"], list)
    assert body["total"] == 0


def test_get_analysis_not_found(test_client, mock_supabase):
    """GET /api/v1/analyses/{id} with non-existent ID returns 404."""
    query = MagicMock()
    query.select.return_value = query
    query.eq.return_value = query
    query.execute.return_value = MagicMock(data=[])
    mock_supabase.table.return_value = query

    response = test_client.get("/api/v1/analyses/non-existent-id")
    assert response.status_code == 404
    assert response.json()["detail"] == "Analysis not found"
