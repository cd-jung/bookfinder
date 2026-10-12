from django.conf import settings
from django.http import JsonResponse


def health(_request):
    return JsonResponse({"status": "ok", "env": settings.DJANGO_ENV, "llmMode": settings.LLM_MODE})
