"""Resource headroom for the dashboard: how much of each limit is used, as a share (0-1).

App metrics come from our own tables (RequestLog, AiUsage, GuideChunk). Cloudflare metrics (CPU time,
requests, D1 rows and storage) come from the GraphQL Analytics API with a read-only token
(CF_ANALYTICS_TOKEN); without it they are reported as unavailable. Results are cached per isolate.
"""

import math
import time
from datetime import UTC, datetime, timedelta

from django.conf import settings

from core.http import HttpError, post_json

GRAPHQL = "https://api.cloudflare.com/client/v4/graphql"
# Workers Paid allowances / limits used as the 100 % mark
REQUESTS_INCLUDED = 10_000_000
D1_ROWS_READ_INCLUDED = 25_000_000_000
D1_ROWS_WRITTEN_INCLUDED = 50_000_000
D1_SIZE_LIMIT = 10 * 1024**3
VECTORIZE_DIMS_INCLUDED = 10_000_000
LATENCY_SLO_MS = 1000
ERROR_BUDGET = 0.01
CACHE_SECONDS = 300
_cache = {"at": 0.0, "value": None}

QUERY = """
query Headroom($account: string!, $script: string!, $db: string!, $since: Time!, $now: Time!, $month: Time!,
               $monthDate: Date!, $today: Date!) {
  viewer {
    accounts(filter: {accountTag: $account}) {
      day: workersInvocationsAdaptive(limit: 1, filter: {scriptName: $script, datetime_geq: $since, datetime_leq: $now}) {
        sum { requests errors }
        quantiles { cpuTimeP50 cpuTimeP99 }
      }
      month: workersInvocationsAdaptive(limit: 1, filter: {scriptName: $script, datetime_geq: $month, datetime_leq: $now}) {
        sum { requests errors }
      }
      d1: d1AnalyticsAdaptiveGroups(limit: 1, filter: {databaseId: $db, date_geq: $monthDate, date_leq: $today}) {
        sum { rowsRead rowsWritten readQueries writeQueries }
      }
      storage: d1StorageAdaptiveGroups(limit: 1, filter: {databaseId: $db, date_geq: $monthDate, date_leq: $today}) {
        max { databaseSizeBytes }
      }
    }
  }
}
"""


def _share(used, limit):
    return round(min(9.99, used / limit), 4) if limit else 0


def _percentile(values, p):
    if not values:
        return 0
    ordered = sorted(values)
    return round(ordered[min(len(ordered) - 1, max(0, math.ceil(p / 100 * len(ordered)) - 1))], 1)


def app_metrics():
    from core.models import AiUsage
    from logs.models import RequestLog
    from rag.models import GuideChunk

    since = datetime.now(UTC) - timedelta(hours=24)
    recent = RequestLog.objects.filter(created_at__gte=since)
    durations = list(recent.order_by("-created_at").values_list("duration_ms", flat=True)[:5000])
    total = recent.count()
    server_errors = recent.filter(status_code__gte=500).count()
    limited = recent.filter(status_code=429).count()
    today = datetime.now(UTC).date().isoformat()
    ai_calls = AiUsage.objects.filter(day=today).values_list("calls", flat=True).first() or 0
    dims = GuideChunk.objects.count() * 1024
    p95 = _percentile(durations, 95)
    error_rate = server_errors / total if total else 0
    return [
        {
            "key": "latencyP95",
            "value": p95,
            "limit": LATENCY_SLO_MS,
            "unit": "ms",
            "share": _share(p95, LATENCY_SLO_MS),
            "extra": {"p50": _percentile(durations, 50), "p99": _percentile(durations, 99)},
        },
        {
            "key": "errorBudget",
            "value": round(error_rate * 100, 2),
            "limit": ERROR_BUDGET * 100,
            "unit": "%",
            "share": _share(error_rate, ERROR_BUDGET),
        },
        {
            "key": "aiBudget",
            "value": ai_calls,
            "limit": settings.AI_DAILY_LIMIT,
            "unit": "calls",
            "share": _share(ai_calls, settings.AI_DAILY_LIMIT),
        },
        {
            "key": "rateLimited",
            "value": limited,
            "limit": total or 1,
            "unit": "requests",
            "share": _share(limited, total or 1),
        },
        {
            "key": "vectorDims",
            "value": dims,
            "limit": VECTORIZE_DIMS_INCLUDED,
            "unit": "dims",
            "share": _share(dims, VECTORIZE_DIMS_INCLUDED),
        },
    ]


def cloudflare_metrics():
    if not (
        settings.CF_ANALYTICS_TOKEN
        and settings.CF_ACCOUNT_ID
        and settings.CF_D1_DATABASE_ID
        and settings.CF_WORKER_NAME
    ):
        return {"available": False, "reason": "not_configured", "metrics": []}
    if _cache["value"] is not None and time.time() - _cache["at"] < CACHE_SECONDS:
        return _cache["value"]
    now = datetime.now(UTC).replace(microsecond=0)
    month = now.replace(day=1, hour=0, minute=0, second=0)
    variables = {
        "account": settings.CF_ACCOUNT_ID,
        "script": settings.CF_WORKER_NAME,
        "db": settings.CF_D1_DATABASE_ID,
        "since": (now - timedelta(hours=24)).isoformat().replace("+00:00", "Z"),
        "now": now.isoformat().replace("+00:00", "Z"),
        "month": month.isoformat().replace("+00:00", "Z"),
        "monthDate": month.date().isoformat(),
        "today": now.date().isoformat(),
    }
    try:
        data = post_json(
            GRAPHQL,
            {"query": QUERY, "variables": variables},
            {"Authorization": f"Bearer {settings.CF_ANALYTICS_TOKEN}"},
            "Cloudflare analytics",
        )
    except (HttpError, ValueError) as exc:
        return {"available": False, "reason": str(exc)[:200], "metrics": []}
    if data.get("errors"):
        return {"available": False, "reason": str(data["errors"][0].get("message", "error"))[:200], "metrics": []}
    account = (data.get("data") or {}).get("viewer", {}).get("accounts", [{}])[0]

    def first(name):
        rows = account.get(name) or []
        return rows[0] if rows else {}

    day, month_row, d1, storage = first("day"), first("month"), first("d1"), first("storage")
    cpu_p99 = ((day.get("quantiles") or {}).get("cpuTimeP99") or 0) / 1000  # microseconds -> ms
    cpu_p50 = ((day.get("quantiles") or {}).get("cpuTimeP50") or 0) / 1000
    requests_month = (month_row.get("sum") or {}).get("requests") or 0
    rows_read = (d1.get("sum") or {}).get("rowsRead") or 0
    rows_written = (d1.get("sum") or {}).get("rowsWritten") or 0
    size = (storage.get("max") or {}).get("databaseSizeBytes") or 0
    value = {
        "available": True,
        "metrics": [
            {
                "key": "cpuP99",
                "value": round(cpu_p99, 1),
                "limit": settings.CPU_LIMIT_MS,
                "unit": "ms",
                "share": _share(cpu_p99, settings.CPU_LIMIT_MS),
                "extra": {"p50": round(cpu_p50, 1)},
            },
            {
                "key": "requestsMonth",
                "value": requests_month,
                "limit": REQUESTS_INCLUDED,
                "unit": "requests",
                "share": _share(requests_month, REQUESTS_INCLUDED),
            },
            {
                "key": "d1Storage",
                "value": size,
                "limit": D1_SIZE_LIMIT,
                "unit": "bytes",
                "share": _share(size, D1_SIZE_LIMIT),
            },
            {
                "key": "d1RowsRead",
                "value": rows_read,
                "limit": D1_ROWS_READ_INCLUDED,
                "unit": "rows",
                "share": _share(rows_read, D1_ROWS_READ_INCLUDED),
            },
            {
                "key": "d1RowsWritten",
                "value": rows_written,
                "limit": D1_ROWS_WRITTEN_INCLUDED,
                "unit": "rows",
                "share": _share(rows_written, D1_ROWS_WRITTEN_INCLUDED),
            },
        ],
    }
    _cache.update(at=time.time(), value=value)
    return value
