import json

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from core import llm
from rag.service import QuestionError, answer


@csrf_exempt
@require_POST
def answers(request):
    try:
        body = json.loads(request.body or b"{}")
    except json.JSONDecodeError:
        return JsonResponse({"detail": "Request body must be JSON"}, status=400)
    try:
        return JsonResponse(answer(body.get("question")))
    except QuestionError as exc:
        return JsonResponse({"detail": str(exc)}, status=400)
    except llm.LLMError as exc:
        response = JsonResponse({"code": exc.code, "detail": str(exc)}, status=exc.status)
        response.log_message = f"{exc.code}: {exc}"
        return response
