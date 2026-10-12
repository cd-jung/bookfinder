"""Per-client rate limit backed by the RequestLog table (shared by every Worker isolate).

The client key is a salted hash of the caller's IP (never the IP itself), written by
RequestLogMiddleware. A limited view returns 429 {"detail", "retryAfter"} with a Retry-After header.
"""

from datetime import UTC, datetime, timedelta
from functools import wraps

from django.http import JsonResponse

WINDOW_SECONDS = 60


def rate_limited(per_minute):
    def decorator(view):
        @wraps(view)
        def wrapper(request, *args, **kwargs):
            from django.conf import settings

            from logs.models import RequestLog

            if not settings.RATE_LIMITS:
                return view(request, *args, **kwargs)

            client = getattr(request, "client_key", "")
            if client:
                since = datetime.now(UTC) - timedelta(seconds=WINDOW_SECONDS)
                recent = RequestLog.objects.filter(client=client, path=request.path, created_at__gte=since)
                times = list(recent.order_by("created_at").values_list("created_at", flat=True)[:per_minute])
                if len(times) >= per_minute:
                    wait = max(1, int(WINDOW_SECONDS - (datetime.now(UTC) - times[0]).total_seconds()) + 1)
                    response = JsonResponse(
                        {"detail": f"Too many questions, please wait {wait} seconds", "retryAfter": wait}, status=429
                    )
                    response["Retry-After"] = str(wait)
                    return response
            return view(request, *args, **kwargs)

        return wrapper

    return decorator
