"""Natural language search catalogue for request logs (Logs & Monitoring page)."""

from datetime import UTC, datetime, timedelta

from django.db.models import Q

from logs.models import RequestLog
from nlsearch.catalog import Catalog, Field, Template


def _recent(params, _alias):
    since = datetime.now(UTC) - timedelta(minutes=params["minutes"])
    return {}, Q(created_at__gte=since)


def _status_class(params, _alias):
    low = int(params["class"][0]) * 100
    return {}, Q(status_code__gte=low, status_code__lt=low + 100)


LOG_CATALOG = Catalog(
    name="logs",
    subject="HTTP request logs of this web service's API",
    model=RequestLog,
    fields={
        "created_at": Field("datetime", "created_at", "When the request was handled (UTC)", label="time"),
        "method": Field("enum", "method", "HTTP method", label="method", choices=["GET", "POST"]),
        "path": Field("string", "path", "Request path, e.g. /api/health", label="path"),
        "status_code": Field("number", "status_code", "HTTP status code", label="status"),
        "duration_ms": Field("number", "duration_ms", "Server time in milliseconds", label="duration (ms)"),
        "level": Field("enum", "level", "Log level", label="level", choices=["INFO", "WARN", "ERROR"]),
        "message": Field("string", "message", "Error message, empty for successful requests", label="message"),
        "country": Field("string", "country", "Two-letter client country code", label="country"),
    },
    templates={
        "recent": Template(
            "Requests in the last N minutes ('last hour' = 60, 'today' = 1440)",
            {"minutes": {"type": "number", "required": True}},
            _recent,
            label="in the last N minutes",
        ),
        "status_class": Template(
            "Status code class",
            {"class": {"type": "enum", "required": True, "choices": ["2xx", "3xx", "4xx", "5xx"]}},
            _status_class,
            label="status class",
        ),
    },
    examples=[
        {
            "question": "errors in the last hour",
            "expected_filter": {
                "and": [
                    {"field": "level", "op": "eq", "value": "ERROR"},
                    {"template": "recent", "params": {"minutes": 60}},
                ]
            },
        },
        {
            "question": "slow requests over 500ms",
            "expected_filter": {"field": "duration_ms", "op": "gt", "value": 500},
        },
        {
            "question": "failed POST requests to the rag api",
            "expected_filter": {
                "and": [
                    {"field": "method", "op": "eq", "value": "POST"},
                    {"field": "path", "op": "icontains", "value": "/api/rag"},
                    {"field": "status_code", "op": "gte", "value": 400},
                ]
            },
        },
        {
            "question": "4xx or 5xx responses",
            "expected_filter": {
                "or": [
                    {"template": "status_class", "params": {"class": "4xx"}},
                    {"template": "status_class", "params": {"class": "5xx"}},
                ]
            },
        },
        {"question": "what is the weather in Seoul", "expected_error": "not about request logs"},
    ],
)
