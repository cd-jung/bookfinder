"""Reusable view helpers so every NL-searchable list gets the same API contract."""

import json

from django.http import JsonResponse

from core import llm
from nlsearch.compiler import FilterValidationError, apply_filter
from nlsearch.translate import QuestionError, UntranslatableError, translate


def translate_response(catalog, request):
    """POST {"question"} -> 200 {filter, description} / 400 / 422 / 502."""
    try:
        body = json.loads(request.body or b"{}")
    except json.JSONDecodeError:
        return JsonResponse({"detail": "Request body must be JSON"}, status=400)
    try:
        return JsonResponse(translate(catalog, body.get("question")))
    except QuestionError as exc:
        return JsonResponse({"detail": str(exc)}, status=400)
    except UntranslatableError as exc:
        return JsonResponse({"detail": str(exc)}, status=422)
    except llm.LLMError as exc:
        return JsonResponse({"code": exc.code, "detail": str(exc)}, status=502)


def filter_from_request(catalog, request, queryset):
    """Apply ?nl_filter=<json>; the filter is re-validated on every request (never trust the client).

    Returns (queryset, error_response).
    """
    raw = request.GET.get("nl_filter")
    if not raw:
        return queryset, None
    try:
        node = json.loads(raw)
        return apply_filter(catalog, queryset, node), None
    except (json.JSONDecodeError, FilterValidationError) as exc:
        return queryset, JsonResponse({"nl_filter": str(exc)}, status=400)
