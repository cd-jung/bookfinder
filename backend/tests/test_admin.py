import pytest

from core.models import AiUsage
from logs import resources
from rag.models import GuideChunk

pytestmark = pytest.mark.django_db


def test_admin_apis_need_the_proxy_secret_when_configured(client, settings):
    settings.ADMIN_PROXY_SECRET = "s3cret"
    assert client.get("/api/logs/stats").status_code == 403
    assert client.get("/api/logs/stats", HTTP_X_ADMIN_PROXY="wrong").status_code == 403
    assert client.get("/api/logs/stats", HTTP_X_ADMIN_PROXY="s3cret").status_code == 200
    assert client.get("/api/books/facets").status_code == 200  # public APIs are not affected


def test_admin_apis_fail_closed_on_workers_without_a_secret(client, settings):
    settings.ADMIN_PROXY_SECRET = ""
    settings.ON_WORKERS = True
    assert client.get("/api/logs/").status_code == 403
    settings.ON_WORKERS = False
    assert client.get("/api/logs/").status_code == 200


def test_resources_report_app_headroom(client, settings):
    settings.AI_DAILY_LIMIT = 100
    from datetime import UTC, datetime

    AiUsage.objects.create(day=datetime.now(UTC).date().isoformat(), calls=25)
    GuideChunk.objects.create(
        id="en/x#0", lang="en", page="x", page_title="X", section="X", anchor="", content="c", content_hash="h"
    )
    for _ in range(3):
        client.get("/api/health")
    body = client.get("/api/logs/resources").json()
    app = {m["key"]: m for m in body["app"]}
    assert app["aiBudget"]["value"] == 25 and app["aiBudget"]["share"] == 0.25
    assert app["vectorDims"]["value"] == 1024
    assert set(app) == {"latencyP95", "errorBudget", "aiBudget", "rateLimited", "vectorDims"}
    assert body["cloudflare"] == {"available": False, "reason": "not_configured", "metrics": []}


def test_cloudflare_metrics_from_graphql(settings, monkeypatch):
    settings.CF_ANALYTICS_TOKEN, settings.CF_ACCOUNT_ID, settings.CF_D1_DATABASE_ID, settings.CF_WORKER_NAME = (
        "t",
        "a",
        "d",
        "w",
    )
    resources._cache["value"] = None
    sent = {}

    def fake_post(url, body, headers, note):
        sent.update(body=body, headers=headers)
        return {
            "data": {
                "viewer": {
                    "accounts": [
                        {
                            "day": [
                                {
                                    "sum": {"requests": 100, "errors": 1},
                                    "quantiles": {"cpuTimeP50": 60000, "cpuTimeP99": 2500000},
                                }
                            ],
                            "month": [{"sum": {"requests": 5_000_000, "errors": 3}}],
                            "d1": [
                                {
                                    "sum": {
                                        "rowsRead": 1_000_000,
                                        "rowsWritten": 10_000_000,
                                        "readQueries": 1,
                                        "writeQueries": 1,
                                    }
                                }
                            ],
                            "storage": [{"max": {"databaseSizeBytes": 5 * 1024**3}}],
                        }
                    ]
                }
            }
        }

    monkeypatch.setattr(resources, "post_json", fake_post)
    result = resources.cloudflare_metrics()
    metrics = {m["key"]: m for m in result["metrics"]}
    assert result["available"] and sent["headers"] == {"Authorization": "Bearer t"}
    assert metrics["cpuP99"]["value"] == 2500.0 and metrics["cpuP99"]["share"] == 0.5
    assert metrics["requestsMonth"]["share"] == 0.5 and metrics["d1Storage"]["share"] == 0.5
    assert metrics["d1RowsWritten"]["share"] == 0.2
    assert sent["body"]["variables"]["script"] == "w"


def test_cloudflare_metrics_report_api_errors(settings, monkeypatch):
    settings.CF_ANALYTICS_TOKEN, settings.CF_ACCOUNT_ID, settings.CF_D1_DATABASE_ID, settings.CF_WORKER_NAME = (
        "t",
        "a",
        "d",
        "w",
    )
    resources._cache["value"] = None
    monkeypatch.setattr(resources, "post_json", lambda *a: {"errors": [{"message": "not authorized"}]})
    assert resources.cloudflare_metrics() == {"available": False, "reason": "not authorized", "metrics": []}
