import math
from datetime import UTC, datetime, timedelta

from django.db.models import Count, Q
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_POST

from logs.catalog import LOG_CATALOG
from logs.models import RequestLog
from nlsearch.views import filter_from_request, translate_response

PAGE_SIZE = 50


@csrf_exempt
@require_POST
def nl_translate(request):
    return translate_response(LOG_CATALOG, request)


@require_GET
def log_list(request):
    queryset, error = filter_from_request(LOG_CATALOG, request, RequestLog.objects.all())
    if error:
        return error
    keyword = request.GET.get("q", "").strip()
    if keyword:
        queryset = queryset.filter(Q(path__icontains=keyword) | Q(message__icontains=keyword))
    level = request.GET.get("level")
    if level in {"INFO", "WARN", "ERROR"}:
        queryset = queryset.filter(level=level)
    total = queryset.count()
    pages = max(1, math.ceil(total / PAGE_SIZE))
    try:
        page = min(max(1, int(request.GET.get("page", 1))), pages)
    except ValueError:
        page = 1
    rows = queryset[(page - 1) * PAGE_SIZE : page * PAGE_SIZE]
    return JsonResponse({"total": total, "page": page, "pages": pages, "results": [r.as_dict() for r in rows]})


def _percentile(values, p):
    if not values:
        return 0
    ordered = sorted(values)
    index = min(len(ordered) - 1, max(0, math.ceil(p / 100 * len(ordered)) - 1))
    return round(ordered[index], 1)


@require_GET
def stats(request):
    """Dashboard numbers for the last N hours (default 24)."""
    try:
        hours = min(max(1, int(request.GET.get("hours", 24))), 24 * 7)
    except ValueError:
        hours = 24
    since = datetime.now(UTC) - timedelta(hours=hours)
    recent = RequestLog.objects.filter(created_at__gte=since)
    total = recent.count()
    errors = recent.filter(status_code__gte=500).count()
    client_errors = recent.filter(status_code__gte=400, status_code__lt=500).count()
    durations = list(recent.order_by("-created_at").values_list("duration_ms", flat=True)[:5000])
    top_paths = list(recent.order_by().values("path").annotate(count=Count("id")).order_by("-count")[:8])
    per_hour = {}
    for created_at, status in recent.values_list("created_at", "status_code")[:20000]:
        bucket = created_at.replace(minute=0, second=0, microsecond=0).isoformat()
        slot = per_hour.setdefault(bucket, {"hour": bucket, "requests": 0, "errors": 0})
        slot["requests"] += 1
        slot["errors"] += 1 if status >= 500 else 0
    return JsonResponse(
        {
            "hours": hours,
            "total": total,
            "serverErrors": errors,
            "clientErrors": client_errors,
            "errorRate": round(errors / total * 100, 2) if total else 0,
            "p50Ms": _percentile(durations, 50),
            "p95Ms": _percentile(durations, 95),
            "topPaths": top_paths,
            "perHour": sorted(per_hour.values(), key=lambda s: s["hour"]),
        }
    )
