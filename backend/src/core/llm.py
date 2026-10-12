"""Single entry point for every LLM and embedding call.

Features never call Workers AI directly; they call `generate()` / `embed()` here so that tests,
CI and E2E runs can switch the implementation with settings.LLM_MODE:

- "real": Workers AI through the `AI` binding (only available on Cloudflare)
- "stub": features provide deterministic fixtures and must not reach this module's real calls
- "down": every call raises LLMUnavailableError (drives the failure-handling scenarios)
"""

import json

from django.conf import settings


class LLMError(Exception):
    """Base class; `code` is returned to the client as {"code", "detail"}."""

    code = "llm_error"
    status = 503


class LLMUnavailableError(LLMError):
    code = "llm_unavailable"


class LLMTimeoutError(LLMError):
    code = "llm_timeout"
    status = 504


def mode():
    return settings.LLM_MODE


def ensure_available():
    if mode() == "down":
        raise LLMUnavailableError("The AI service is unavailable.")


def _js(value):
    from js import Object
    from pyodide.ffi import to_js

    return to_js(value, dict_converter=Object.fromEntries)


def _py(value):
    """Convert a JS result to plain Python. Binding results can be class instances (e.g. VectorizeMatches),
    which Pyodide's to_py() leaves as JsProxy, so go through JSON."""
    if not hasattr(value, "to_py"):
        return value
    from js import JSON

    return json.loads(JSON.stringify(value))


def _spend_budget():
    """Count one real AI call against today's AI_DAILY_LIMIT; refuse once the budget is used up."""
    from datetime import UTC, datetime

    from django.db.models import F

    from core.models import AiUsage

    day = datetime.now(UTC).date()
    if not AiUsage.objects.filter(day=day).update(calls=F("calls") + 1):
        AiUsage.objects.get_or_create(day=day, defaults={"calls": 1})
    if AiUsage.objects.get(day=day).calls > settings.AI_DAILY_LIMIT:
        raise LLMUnavailableError("The daily AI budget is used up. Please try again tomorrow.")


def _run_ai(model, payload):
    _spend_budget()
    from pyodide.ffi import run_sync

    from core.runtime import workers_env

    env = workers_env()
    if env is None or not hasattr(env, "AI"):
        raise LLMUnavailableError("Workers AI binding is not configured.")
    try:
        result = run_sync(env.AI.run(model, _js(payload)))
    except Exception as exc:  # JS errors surface as generic exceptions
        message = str(exc)
        if "timeout" in message.lower():
            raise LLMTimeoutError("The AI service took too long to respond.") from exc
        raise LLMUnavailableError(f"The AI service failed: {message[:200]}") from exc
    return _py(result)


def generate(prompt, *, system=None, max_tokens=600):
    """Return the model's text for `prompt` (temperature 0 for reproducible output)."""
    ensure_available()
    messages = ([{"role": "system", "content": system}] if system else []) + [{"role": "user", "content": prompt}]
    result = _run_ai(settings.LLM_MODEL, {"messages": messages, "max_tokens": max_tokens, "temperature": 0})
    return _text_of(result)


def _text_of(result):
    """Workers AI returns {"response": str}; JSON-looking output may arrive already parsed, and some
    models use the OpenAI shape {"choices": [{"message": {"content": str}}]}."""
    text = None
    if isinstance(result, dict):
        text = result.get("response")
        if text is None and result.get("choices"):
            text = (result["choices"][0].get("message") or {}).get("content")
    if isinstance(text, dict | list):
        text = json.dumps(text)
    if not isinstance(text, str) or not text.strip():
        keys = sorted(result) if isinstance(result, dict) else type(result).__name__
        raise LLMUnavailableError(f"The AI service returned an empty answer ({keys}).")
    return text


def embed(texts):
    """Return one embedding vector per input text."""
    ensure_available()
    result = _run_ai(settings.EMBEDDING_MODEL, {"text": list(texts)})
    vectors = result.get("data") or result.get("response") if isinstance(result, dict) else None
    if not vectors:
        raise LLMUnavailableError("The embedding model returned no vectors.")
    return [list(v) for v in vectors]


def vector_query(vector, top_k):
    """Query the Vectorize index; returns [{"id", "score", "metadata"}]."""
    ensure_available()
    from pyodide.ffi import run_sync

    from core.runtime import workers_env

    env = workers_env()
    if env is None or not hasattr(env, "VECTORIZE"):
        raise LLMUnavailableError("Vectorize binding is not configured.")
    result = _py(run_sync(env.VECTORIZE.query(_js(vector), _js({"topK": top_k, "returnMetadata": "none"}))))
    return [
        {"id": m.get("id"), "score": float(m.get("score", 0)), "metadata": m.get("metadata") or {}}
        for m in result.get("matches", [])
    ]
