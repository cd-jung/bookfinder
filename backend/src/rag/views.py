import json

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from core import llm
from core.i18n import normalize
from core.ratelimit import rate_limited
from rag.service import QuestionError, answer


@csrf_exempt
@require_POST
@rate_limited(10)
def answers(request):
    try:
        body = json.loads(request.body or b"{}")
    except json.JSONDecodeError:
        return JsonResponse({"detail": "Request body must be JSON"}, status=400)
    try:
        history = body.get("history") if isinstance(body.get("history"), list) else None
        return JsonResponse(answer(body.get("question"), history, normalize(body.get("lang"))))
    except QuestionError as exc:
        return JsonResponse({"detail": str(exc)}, status=400)
    except llm.LLMError as exc:
        response = JsonResponse({"code": exc.code, "detail": str(exc)}, status=exc.status)
        response.log_message = f"{exc.code}: {exc}"
        return response


@csrf_exempt
@require_POST
@rate_limited(20)
def feedback(request):
    try:
        body = json.loads(request.body or b"{}")
    except json.JSONDecodeError:
        return JsonResponse({"detail": "Request body must be JSON"}, status=400)
    if not isinstance(body.get("helpful"), bool) or not isinstance(body.get("question"), str):
        return JsonResponse({"detail": "question and helpful are required"}, status=400)
    from rag.models import AnswerFeedback

    AnswerFeedback.objects.create(
        question=body["question"][:1000],
        answer=str(body.get("answer", ""))[:5000],
        helpful=body["helpful"],
        comment=str(body.get("comment", ""))[:1000],
    )
    return JsonResponse({"detail": "Thanks for the feedback"}, status=201)
