import hashlib
import hmac
import json
import random
import sys
import time
import uuid
from datetime import UTC, datetime, timedelta

from django.conf import settings
from django.http import HttpResponse, JsonResponse


class CorsMiddleware:
    """Allow the frontend (a different origin: its own Worker) to call the API."""

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
        # Preview URLs of a workers.dev frontend: https://<version>-<name>.<subdomain>.workers.dev
        return any(
            o.startswith("https://")
            and o.endswith(".workers.dev")
            and origin.startswith("https://")
            and origin.endswith("-" + o[len("https://") :])
            for o in settings.ALLOWED_ORIGINS
        )


class EdgeRateLimitMiddleware:
    """Per-client request limits enforced by Cloudflare's Rate Limiting bindings (no D1 reads or writes).

    API_LIMITER covers every /api/ request, AI_LIMITER the endpoints that call Workers AI. Limits are set
    in wrangler.jsonc ("ratelimits"). Locally (no bindings) and with RATE_LIMITS=0 this does nothing.
    """

    AI_PATHS = ("/translate", "/api/rag/answers")

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.method == "OPTIONS" or not request.path.startswith("/api/") or not settings.RATE_LIMITS:
            return self.get_response(request)
        key = request.headers.get("Cf-Connecting-Ip") or request.META.get("REMOTE_ADDR", "")
        if not self._allowed("API_LIMITER", key) or (
            request.path.endswith(self.AI_PATHS) and not self._allowed("AI_LIMITER", key)
        ):
            response = JsonResponse({"detail": "Too many requests, please wait a minute", "retryAfter": 60}, status=429)
            response["Retry-After"] = "60"
            return response
        return self.get_response(request)

    @staticmethod
    def _allowed(binding, key):
        from core.runtime import workers_env

        env = workers_env()
        limiter = getattr(env, binding, None) if env is not None else None
        if limiter is None or not key:
            return True
        try:
            from js import Object
            from pyodide.ffi import run_sync, to_js

            outcome = run_sync(limiter.limit(to_js({"key": key}, dict_converter=Object.fromEntries)))
            return bool(getattr(outcome, "success", True))
        except Exception as exc:  # a limiter failure must not take the API down
            print(f"rate limiter {binding} failed: {exc}", file=sys.stderr)
            return True


class AdminOnlyMiddleware:
    """Admin APIs (settings.ADMIN_PATHS) answer only requests proxied by the admin Worker.

    The admin Worker sits behind Cloudflare Access, verifies the Access JWT and adds the shared
    X-Admin-Proxy secret. On Workers without a configured secret the admin APIs are closed (fail closed).
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path.startswith(settings.ADMIN_PATHS) and request.method != "OPTIONS":
            secret = settings.ADMIN_PROXY_SECRET
            given = request.headers.get("X-Admin-Proxy", "")
            if secret:
                if not hmac.compare_digest(given.encode(), secret.encode()):
                    return JsonResponse(
                        {"detail": "This admin API is only available through the admin site."}, status=403
                    )
            elif settings.ON_WORKERS:
                return JsonResponse({"detail": "Admin access is not configured."}, status=403)
        return self.get_response(request)


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
        ip = request.headers.get("Cf-Connecting-Ip") or request.META.get("REMOTE_ADDR", "")
        request.client_key = hashlib.sha256(f"{settings.SECRET_KEY}:{ip}".encode()).hexdigest()[:16] if ip else ""
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
            "client": getattr(request, "client_key", ""),
        }
        print(json.dumps({"type": "request", **entry}))
        try:
            RequestLog.objects.create(**entry)
            if random.random() < 0.005:
                self._prune(RequestLog)
        except Exception as exc:
            print(f"request log write failed: {exc}", file=sys.stderr)

    @staticmethod
    def _prune(model):
        """Delete a batch of logs older than LOG_RETENTION_DAYS (keeps D1 storage bounded)."""
        cutoff = datetime.now(UTC) - timedelta(days=settings.LOG_RETENTION_DAYS)
        old = list(model.objects.filter(created_at__lt=cutoff).values_list("id", flat=True)[:500])
        if old:
            model.objects.filter(id__in=old).delete()
