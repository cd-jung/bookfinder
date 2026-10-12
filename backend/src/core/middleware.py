import json
import sys
import time
import uuid

from django.conf import settings
from django.http import HttpResponse


class CorsMiddleware:
    """Allow the Pages frontend (a different origin) to call the API."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        origin = request.headers.get("Origin", "")
        if request.method == "OPTIONS":
            response = HttpResponse(status=204)
        else:
            response = self.get_response(request)
        if origin and self._allowed(origin):
            response["Access-Control-Allow-Origin"] = origin
            response["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
            response["Access-Control-Allow-Headers"] = "Content-Type"
            response["Vary"] = "Origin"
        return response

    @staticmethod
    def _allowed(origin):
        if origin in settings.ALLOWED_ORIGINS:
            return True
        # Preview deployments: https://<hash>.<project>.pages.dev
        return any(
            o.startswith("https://") and o.endswith(".pages.dev") and origin.endswith("." + o[len("https://") :])
            for o in settings.ALLOWED_ORIGINS
        )


class RequestLogMiddleware:
    """Log every API request twice: to stdout (Cloudflare Workers Logs) and to the RequestLog table.

    The table is what the Logs page searches (natural language -> ORM) and aggregates for the dashboard.
    Logging must never break a request, so database errors are swallowed and reported to stderr.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.method == "OPTIONS" or not request.path.startswith("/api/"):
            return self.get_response(request)
        request_id = request.headers.get("Cf-Ray") or uuid.uuid4().hex[:16]
        started = time.perf_counter()
        error = ""
        try:
            response = self.get_response(request)
        except Exception as exc:  # re-raised after logging
            error = f"{type(exc).__name__}: {exc}"
            self._write(request, request_id, 500, started, error)
            raise
        self._write(request, request_id, response.status_code, started, getattr(response, "log_message", ""))
        response["X-Request-Id"] = request_id
        return response

    def _write(self, request, request_id, status, started, message):
        from logs.models import RequestLog

        duration = round((time.perf_counter() - started) * 1000, 2)
        level = "ERROR" if status >= 500 else "WARN" if status >= 400 else "INFO"
        entry = {
            "request_id": request_id,
            "method": request.method,
            "path": request.path[:300],
            "status_code": status,
            "duration_ms": duration,
            "level": level,
            "message": (message or "")[:500],
            "country": request.headers.get("Cf-Ipcountry", "")[:8],
        }
        print(json.dumps({"type": "request", **entry}))
        try:
            RequestLog.objects.create(**entry)
        except Exception as exc:
            print(f"request log write failed: {exc}", file=sys.stderr)
