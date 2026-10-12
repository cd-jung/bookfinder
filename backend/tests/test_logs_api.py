import json
from datetime import UTC, datetime, timedelta

import pytest

from logs.models import RequestLog

pytestmark = pytest.mark.django_db


def _log(**kwargs):
    defaults = {
        "request_id": "r",
        "method": "GET",
        "path": "/api/x",
        "status_code": 200,
        "duration_ms": 10,
        "level": "INFO",
    }
    return RequestLog.objects.create(**{**defaults, **kwargs})


def test_translate_endpoint_contract(client):
    ok = client.post(
        "/api/logs/nl-search/translate", {"question": "slow requests over 500ms"}, content_type="application/json"
    )
    assert ok.status_code == 200 and ok.json()["description"] == "duration (ms) over 500"
    assert (
        client.post("/api/logs/nl-search/translate", {"question": ""}, content_type="application/json").status_code
        == 400
    )
    assert client.post("/api/logs/nl-search/translate", "{bad", content_type="application/json").status_code == 400
    refused = client.post(
        "/api/logs/nl-search/translate", {"question": "what is the weather in Seoul"}, content_type="application/json"
    )
    assert refused.status_code == 422


def test_translate_returns_502_when_llm_is_down(client, settings):
    settings.LLM_MODE = "down"
    response = client.post("/api/logs/nl-search/translate", {"question": "errors"}, content_type="application/json")
    assert response.status_code == 502 and response.json()["code"] == "llm_unavailable"


def test_list_applies_nl_filter_and_rejects_tampering(client):
    _log(duration_ms=800, path="/api/slow")
    _log(duration_ms=5)
    nl = json.dumps({"field": "duration_ms", "op": "gt", "value": 500})
    body = client.get("/api/logs/", {"nl_filter": nl}).json()
    assert [r["path"] for r in body["results"]] == ["/api/slow"]
    tampered = client.get("/api/logs/", {"nl_filter": json.dumps({"field": "id", "op": "gt", "value": 0})})
    assert tampered.status_code == 400 and "not allowed" in tampered.json()["nl_filter"]
    assert client.get("/api/logs/", {"nl_filter": "{oops"}).status_code == 400


def test_list_keyword_level_and_paging(client):
    for n in range(55):
        _log(path=f"/api/item/{n}", level="ERROR" if n % 5 == 0 else "INFO")
    errors = client.get("/api/logs/", {"level": "ERROR"}).json()
    assert errors["total"] == 11
    assert client.get("/api/logs/", {"q": "item/54"}).json()["total"] == 1
    page2 = client.get("/api/logs/", {"page": 99}).json()
    assert page2["page"] == 2 and len(page2["results"]) == page2["total"] - 50
    assert client.get("/api/logs/", {"page": "x"}).json()["page"] == 1


def test_stats_summarises_recent_requests(client):
    _log(status_code=500, level="ERROR", duration_ms=100)
    _log(status_code=404, level="WARN", duration_ms=20)
    _log(duration_ms=30)
    old = _log(duration_ms=1)
    RequestLog.objects.filter(pk=old.pk).update(created_at=datetime.now(UTC) - timedelta(days=3))
    stats = client.get("/api/logs/stats", {"hours": 24}).json()
    assert stats["total"] == 3
    assert stats["serverErrors"] == 1 and stats["clientErrors"] == 1
    assert stats["errorRate"] == 33.33
    assert stats["p95Ms"] == 100
    assert stats["topPaths"][0] == {"path": "/api/x", "count": 3}
    assert sum(h["requests"] for h in stats["perHour"]) == 3


def test_stats_with_no_data_and_bad_hours(client):
    stats = client.get("/api/logs/stats", {"hours": "abc"}).json()
    assert stats["hours"] == 24 and stats["total"] == 0 and stats["p95Ms"] == 0
