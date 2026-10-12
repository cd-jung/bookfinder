from datetime import UTC, datetime, timedelta

import pytest

from core import llm, middleware
from core.models import AiUsage
from logs.models import RequestLog

pytestmark = pytest.mark.django_db


def test_edge_rate_limit_blocks_without_writing_logs(client, monkeypatch):
    calls = []

    def fake_allowed(binding, key):
        calls.append(binding)
        return binding != "API_LIMITER"

    monkeypatch.setattr(middleware.EdgeRateLimitMiddleware, "_allowed", staticmethod(fake_allowed))
    response = client.get("/api/health", REMOTE_ADDR="203.0.113.9")
    assert response.status_code == 429 and response["Retry-After"] == "60"
    assert calls == ["API_LIMITER"] and RequestLog.objects.count() == 0


def test_ai_paths_use_the_stricter_limiter(client, monkeypatch):
    seen = []

    def fake_allowed(binding, key):
        seen.append(binding)
        return binding != "AI_LIMITER"

    monkeypatch.setattr(middleware.EdgeRateLimitMiddleware, "_allowed", staticmethod(fake_allowed))
    assert client.get("/api/health").status_code == 200
    blocked = client.post("/api/rag/answers", {"question": "x"}, content_type="application/json")
    assert blocked.status_code == 429 and seen[-2:] == ["API_LIMITER", "AI_LIMITER"]


def test_limiter_is_a_no_op_without_bindings_or_when_disabled(client, settings):
    assert middleware.EdgeRateLimitMiddleware._allowed("API_LIMITER", "1.2.3.4") is True
    settings.RATE_LIMITS = False
    assert client.get("/api/health").status_code == 200


def test_daily_ai_budget(settings):
    settings.AI_DAILY_LIMIT = 2
    llm._spend_budget()
    llm._spend_budget()
    with pytest.raises(llm.LLMUnavailableError, match="daily AI budget"):
        llm._spend_budget()
    assert AiUsage.objects.get(day=datetime.now(UTC).date().isoformat()).calls == 3
    AiUsage.objects.create(day="2020-01-01", calls=999)  # other days do not count


def test_oversized_bodies_are_rejected(client):
    response = client.post("/api/rag/answers", "{" + '"q": "' + "x" * 70_000 + '"}', content_type="application/json")
    assert response.status_code in (400, 413)


def test_security_headers_on_api_responses(client):
    response = client.get("/api/health")
    assert response["X-Content-Type-Options"] == "nosniff"
    assert response["Referrer-Policy"] == "same-origin"


def test_old_logs_are_pruned(settings):
    settings.LOG_RETENTION_DAYS = 14
    fresh = RequestLog.objects.create(
        request_id="a", method="GET", path="/api/x", status_code=200, duration_ms=1, level="INFO"
    )
    old = RequestLog.objects.create(
        request_id="b", method="GET", path="/api/x", status_code=200, duration_ms=1, level="INFO"
    )
    RequestLog.objects.filter(pk=old.pk).update(created_at=datetime.now(UTC) - timedelta(days=30))
    middleware.RequestLogMiddleware._prune(RequestLog)
    assert list(RequestLog.objects.all()) == [fresh]
