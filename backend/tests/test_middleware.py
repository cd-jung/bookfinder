import pytest

from logs.models import RequestLog

pytestmark = pytest.mark.django_db


def test_api_requests_are_logged_with_level_from_status(client):
    client.get("/api/health")
    client.get("/api/does-not-exist")
    rows = {r.path: r for r in RequestLog.objects.all()}
    assert rows["/api/health"].status_code == 200 and rows["/api/health"].level == "INFO"
    assert rows["/api/does-not-exist"].status_code == 404 and rows["/api/does-not-exist"].level == "WARN"


def test_non_api_and_preflight_requests_are_not_logged(client):
    client.get("/")
    client.options("/api/health")
    assert RequestLog.objects.count() == 0


def test_response_carries_request_id(client):
    assert client.get("/api/health")["X-Request-Id"]


def test_cors_allows_configured_origin_and_previews(client, settings):
    settings.ALLOWED_ORIGINS = ["https://my-app.pages.dev"]
    assert client.get("/api/health", HTTP_ORIGIN="https://my-app.pages.dev")["Access-Control-Allow-Origin"]
    preview = client.get("/api/health", HTTP_ORIGIN="https://abc123.my-app.pages.dev")
    assert preview["Access-Control-Allow-Origin"] == "https://abc123.my-app.pages.dev"
    other = client.get("/api/health", HTTP_ORIGIN="https://evil.example")
    assert "Access-Control-Allow-Origin" not in other


def test_preflight_returns_204_with_cors_headers(client, settings):
    settings.ALLOWED_ORIGINS = ["https://my-app.pages.dev"]
    response = client.options("/api/rag/answers", HTTP_ORIGIN="https://my-app.pages.dev")
    assert response.status_code == 204
    assert response["Access-Control-Allow-Methods"] == "GET, POST, OPTIONS"
