from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture()
def test_client():
    """FastAPI test client."""
    return TestClient(app)


@pytest.fixture()
def mock_supabase():
    """Mock Supabase client patched where it's used (the router module)."""
    mock_client = MagicMock()
    with patch("app.routers.analyses.get_supabase_client", return_value=mock_client):
        yield mock_client
