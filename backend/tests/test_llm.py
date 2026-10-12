import pytest

from core import llm


def test_down_mode_blocks_every_call(settings):
    settings.LLM_MODE = "down"
    for call in (lambda: llm.generate("x"), lambda: llm.embed(["x"]), lambda: llm.vector_query([0.1], 1)):
        with pytest.raises(llm.LLMUnavailableError):
            call()


@pytest.mark.django_db
def test_real_mode_without_workers_runtime_is_unavailable(settings):
    settings.LLM_MODE = "real"
    with pytest.raises((llm.LLMUnavailableError, ImportError)):
        llm.generate("x")


def test_error_codes_and_statuses():
    assert (llm.LLMUnavailableError.code, llm.LLMUnavailableError.status) == ("llm_unavailable", 503)
    assert (llm.LLMTimeoutError.code, llm.LLMTimeoutError.status) == ("llm_timeout", 504)


@pytest.mark.parametrize(
    "result, text",
    [
        ({"response": "plain"}, "plain"),
        ({"response": {"field": "level"}}, '{"field": "level"}'),
        ({"choices": [{"message": {"content": "openai shape"}}]}, "openai shape"),
    ],
)
def test_text_of_accepts_workers_ai_shapes(result, text):
    assert llm._text_of(result) == text


@pytest.mark.parametrize("result", [{"response": ""}, {}, None])
def test_text_of_rejects_empty_answers(result):
    with pytest.raises(llm.LLMUnavailableError, match="empty answer"):
        llm._text_of(result)


def test_py_passes_python_values_through():
    assert llm._py({"matches": []}) == {"matches": []}
