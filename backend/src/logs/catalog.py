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
        "created_at": Field(
            "datetime",
            "created_at",
            "When the request was handled (UTC)",
            label={"en": "time", "es": "hora", "fr": "heure", "ko": "시간"},
        ),
        "method": Field(
            "enum",
            "method",
            "HTTP method",
            label={"en": "method", "es": "método", "fr": "méthode", "ko": "메서드"},
            choices=["GET", "POST"],
        ),
        "path": Field(
            "string",
            "path",
            "Request path, e.g. /api/health",
            label={"en": "path", "es": "ruta", "fr": "chemin", "ko": "경로"},
        ),
        "status_code": Field(
            "number",
            "status_code",
            "HTTP status code",
            label={"en": "status", "es": "estado", "fr": "statut", "ko": "상태 코드"},
        ),
        "duration_ms": Field(
            "number",
            "duration_ms",
            "Server time in milliseconds",
            label={"en": "duration (ms)", "es": "duración (ms)", "fr": "durée (ms)", "ko": "소요 시간(ms)"},
        ),
        "level": Field(
            "enum",
            "level",
            "Log level",
            label={"en": "level", "es": "nivel", "fr": "niveau", "ko": "수준"},
            choices=["INFO", "WARN", "ERROR"],
        ),
        "message": Field(
            "string",
            "message",
            "Error message, empty for successful requests",
            label={"en": "message", "es": "mensaje", "fr": "message", "ko": "메시지"},
        ),
        "country": Field(
            "string",
            "country",
            "Two-letter client country code",
            label={"en": "country", "es": "país", "fr": "pays", "ko": "국가"},
        ),
    },
    templates={
        "recent": Template(
            "Requests in the last N minutes ('last hour' = 60, 'today' = 1440)",
            {"minutes": {"type": "number", "required": True}},
            _recent,
            label={
                "en": "in the last N minutes",
                "es": "en los últimos N minutos",
                "fr": "dans les N dernières minutes",
                "ko": "최근 N분 이내",
            },
        ),
        "status_class": Template(
            "Status code class",
            {"class": {"type": "enum", "required": True, "choices": ["2xx", "3xx", "4xx", "5xx"]}},
            _status_class,
            label={"en": "status class", "es": "clase de estado", "fr": "classe de statut", "ko": "상태 코드 범위"},
        ),
    },
    examples=[
        {
            "question": "errors in the last hour",
            "chip": True,
            "translations": {
                "es": "errores en la última hora",
                "fr": "erreurs de la dernière heure",
                "ko": "최근 1시간 동안의 오류",
            },
            "expected_filter": {
                "and": [
                    {"field": "level", "op": "eq", "value": "ERROR"},
                    {"template": "recent", "params": {"minutes": 60}},
                ]
            },
        },
        {
            "question": "slow requests over 500ms",
            "chip": True,
            "translations": {
                "es": "solicitudes lentas de más de 500 ms",
                "fr": "requêtes lentes de plus de 500 ms",
                "ko": "500ms보다 느린 요청",
            },
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
            "chip": True,
            "translations": {"es": "respuestas 4xx o 5xx", "fr": "réponses 4xx ou 5xx", "ko": "4xx 또는 5xx 응답"},
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
