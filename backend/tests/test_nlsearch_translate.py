import json

import pytest

from core import llm
from logs.catalog import LOG_CATALOG
from nlsearch import translate as translate_module
from nlsearch.translate import (
    QuestionError,
    UntranslatableError,
    build_prompt,
    parse_model_output,
    translate,
)


def test_stub_translation_returns_filter_and_description():
    result = translate(LOG_CATALOG, "Errors in the  last hour")
    assert result["filter"]["and"][0] == {"field": "level", "op": "eq", "value": "ERROR"}
    assert "level is ERROR" in result["description"]


@pytest.mark.parametrize("question", ["", "   ", None, "x" * 501])
def test_blank_or_too_long_question_is_rejected(question):
    with pytest.raises(QuestionError):
        translate(LOG_CATALOG, question)


def test_model_refusal_and_unknown_questions_are_untranslatable():
    with pytest.raises(UntranslatableError, match="rephrase"):
        translate(LOG_CATALOG, "what is the weather in Seoul")
    with pytest.raises(UntranslatableError):
        translate(LOG_CATALOG, "something the stub does not know")


def test_invalid_generated_filter_is_rejected(monkeypatch):
    monkeypatch.setattr(
        translate_module, "question_to_filter", lambda c, q: {"field": "password", "op": "eq", "value": "x"}
    )
    with pytest.raises(UntranslatableError, match="not valid"):
        translate(LOG_CATALOG, "anything")


def test_down_mode_raises_llm_error(settings):
    settings.LLM_MODE = "down"
    with pytest.raises(llm.LLMUnavailableError):
        translate(LOG_CATALOG, "errors in the last hour")


def test_real_mode_parses_model_output(settings, monkeypatch):
    settings.LLM_MODE = "real"
    seen = {}

    def fake_generate(prompt, **_):
        seen["prompt"] = prompt
        return '```json\n{"field": "status_code", "op": "gte", "value": 500}\n```'

    monkeypatch.setattr(llm, "generate", fake_generate)
    result = translate(LOG_CATALOG, "server errors")
    assert result["filter"] == {"field": "status_code", "op": "gte", "value": 500}
    assert "<<<QUESTION\nserver errors\nQUESTION>>>" in seen["prompt"]


def test_prompt_contains_catalogue_but_no_orm_paths():
    prompt = build_prompt(LOG_CATALOG, "q")
    catalogue = json.loads(prompt.split("Catalog:\n", 1)[1].split("\n\nThe user's question", 1)[0])
    assert set(catalogue["fields"]) == set(LOG_CATALOG.fields)
    assert "path" not in catalogue["fields"]["level"]


@pytest.mark.parametrize("text", ["no json here", "{not json}"])
def test_unparseable_model_output_is_an_llm_error(text):
    with pytest.raises(llm.LLMUnavailableError):
        parse_model_output(text)


def test_ansi_codes_are_stripped():
    assert parse_model_output('\x1b[32m{"a": 1}\x1b[0m') == {"a": 1}
