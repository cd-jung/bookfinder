import json

import pytest
from django.core.management import call_command

from books.catalog import BOOK_CATALOG, EXAMPLES
from core.i18n import normalize, pick, request_lang
from logs.catalog import LOG_CATALOG
from nlsearch.compiler import describe_filter
from rag import service
from rag.models import GuideChunk

pytestmark = pytest.mark.django_db
KOREAN_NOVELS = EXAMPLES[0]["expected_filter"]


def test_language_helpers(rf):
    assert normalize("ko-KR") == "ko" and normalize("de") == "en" and normalize(None) == "en"
    assert pick({"en": "a", "ko": "b"}, "ko") == "b" and pick({"en": "a"}, "fr") == "a" and pick("x", "ko") == "x"
    assert request_lang(rf.get("/", {"lang": "fr"})) == "fr"
    assert request_lang(rf.post("/", json.dumps({"lang": "es"}), content_type="application/json")) == "es"
    assert request_lang(rf.post("/", "{bad", content_type="application/json")) == "en"


@pytest.mark.parametrize(
    "lang, text",
    [
        (
            "en",
            "(language is Korean AND genre is literary-fiction AND published after 2015 AND price under $20 AND rating 4 or more)",
        ),
        (
            "es",
            "(idioma es coreano Y género es ficción literaria Y publicado después de 2015 Y precio menor que $20 Y valoración 4 o más)",
        ),
        (
            "fr",
            "(langue est coréen ET genre est littérature ET publié après 2015 ET prix inférieur à $20 ET note 4 ou plus)",
        ),
        (
            "ko",
            "(언어: 한국어 그리고 장르: 문학 그리고 2015년보다 나중에 출판 그리고 가격 $20 미만 그리고 평점 4 이상)",
        ),
    ],
)
def test_interpreted_as_in_every_language(lang, text):
    assert describe_filter(BOOK_CATALOG, KOREAN_NOVELS, lang) == text


def test_not_or_templates_and_booleans_are_localized():
    node = {
        "and": [
            {"not": {"field": "format", "op": "eq", "value": "Audiobook"}},
            {"field": "in_stock", "op": "eq", "value": True},
        ]
    }
    assert describe_filter(BOOK_CATALOG, node, "ko") == "(형식: 오디오북 아님 그리고 재고 있음)"
    assert (
        describe_filter(BOOK_CATALOG, {"template": "new_release", "params": {"days": 90}}, "fr") == "nouveauté(days=90)"
    )
    assert (
        describe_filter(LOG_CATALOG, {"field": "message", "op": "isnull", "value": False}, "es")
        == "mensaje no está vacío"
    )


def test_translated_chip_questions_work_with_the_stub(client):
    for lang in ("en", "es", "fr", "ko"):
        chips = client.get("/api/nl-search/examples", {"lang": lang}).json()["examples"]
        assert len(chips) == 3
        response = client.post(
            "/api/nl-search/translate", {"question": chips[0], "lang": lang}, content_type="application/json"
        )
        assert response.status_code == 200 and response.json()["filter"] == KOREAN_NOVELS
    log_chips = client.get("/api/logs/nl-search/examples", {"lang": "ko"}).json()["examples"]
    assert log_chips[0] == "최근 1시간 동안의 오류"


def test_book_detail_description_follows_the_language(client):
    call_command("seed_demo", count=50, verbosity=0)
    english = client.get("/api/books/1").json()
    french = client.get("/api/books/1", {"lang": "fr"}).json()
    assert english["title"] == french["title"] == "Dune"
    assert english["description"].startswith("Set among distant colonies")
    assert french["description"].startswith("Parmi des colonies lointaines") and "le désert" in french["description"]
    assert client.get("/api/books/1", {"lang": "ko"}).json()["description"].endswith("주제: 사막 · 정치.")


def test_guide_is_indexed_per_language_with_identical_pages():
    call_command("index_guide", verbosity=0)
    pages = {
        lang: set(GuideChunk.objects.filter(lang=lang).values_list("page", flat=True))
        for lang in ("en", "es", "fr", "ko")
    }
    assert pages["en"] and all(p == pages["en"] for p in pages.values())
    assert GuideChunk.objects.filter(id__startswith="ko/").exists()


def test_help_retrieves_and_refuses_in_the_ui_language():
    call_command("index_guide", verbosity=0)
    korean = service.answer("가격 필터는 어떻게 쓰나요?", lang="ko")
    assert korean["has_sufficient_context"] and korean["sources"][0]["url"].startswith("/guide/02-searching-books#")
    assert service.answer("오늘 서울 날씨 알려줘", lang="ko")["answer"] == service.NO_CONTEXT_ANSWERS["ko"]
    assert service.answer("What is the weather?", lang="fr")["answer"] == service.NO_CONTEXT_ANSWERS["fr"]


def test_language_rule_follows_script_then_ui_language():
    assert "Korean" in service.language_rule("가격?", "en")
    assert "French" in service.language_rule("How do I filter?", "fr")
    assert "same language" in service.language_rule("How do I filter?", "en")
