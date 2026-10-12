import json

import pytest
from django.core.management import call_command

from books import views
from books.models import Book

pytestmark = pytest.mark.django_db


@pytest.fixture
def catalogue():
    call_command("seed_demo", count=1500, verbosity=0)
    views._facets_cache["value"] = None


def get(client, **params):
    response = client.get("/api/books", params)
    assert response.status_code == 200, response.content
    return response.json()


def test_facets(client, catalogue):
    body = client.get("/api/books/facets").json()
    assert [g["slug"] for g in body["genres"]][:2] == ["fantasy", "science-fiction"]
    assert body["languages"][0] == "English" and "Audiobook" in body["formats"]
    assert body["yearRange"][0] <= 1965 <= body["yearRange"][1]


def test_default_list_is_popular_first_with_20_per_page(client, catalogue):
    body = get(client)
    assert body["total"] == 1500 and body["pages"] == 75 and len(body["results"]) == 20
    popularity = [Book.objects.get(pk=r["id"]).popularity for r in body["results"]]
    assert popularity == sorted(popularity, reverse=True)
    card = body["results"][0]
    assert set(card) >= {"title", "authors", "year", "rating", "price", "inStock", "coverColor"}


def test_keyword_matches_title_author_publisher_description(client, catalogue):
    assert all("dune" in r["title"].lower() for r in get(client, q="dune")["results"])
    assert {r["title"] for r in get(client, q="han kang")["results"]} >= {"The Vegetarian", "Human Acts"}
    publisher = Book.objects.first().publisher
    assert get(client, q=publisher)["total"] > 0
    assert get(client, q="archives and first-hand voices")["total"] > 0  # description text


def test_isbn_with_or_without_hyphens_ranks_that_book_first(client, catalogue):
    book = Book.objects.get(title="Neuromancer")
    hyphenated = f"{book.isbn13[:3]}-{book.isbn13[3:6]}-{book.isbn13[6:]}"
    for query in (book.isbn13, hyphenated):
        assert get(client, q=query)["results"][0]["id"] == book.id


def test_special_and_long_keywords_do_not_break(client, catalogue):
    assert get(client, q="%_'\";--")["total"] == 0
    assert get(client, q="x" * 5000)["total"] == 0


def test_genre_filter_is_or_within_and_across_filters(client, catalogue):
    both = get(client, genre="fantasy,poetry")
    for card in both["results"]:
        assert {"fantasy", "poetry"} & set(card["genres"])
    fantasy = get(client, genre="fantasy")["total"]
    poetry = get(client, genre="poetry")["total"]
    assert max(fantasy, poetry) <= both["total"] <= fantasy + poetry
    combined = get(client, genre="fantasy", language="English", in_stock="1", q="the")
    for card in combined["results"]:
        assert "fantasy" in card["genres"] and card["language"] == "English" and card["inStock"]


def test_year_language_format_rating_price_filters(client, catalogue):
    years = get(client, year_from=2015, year_to=2018)
    assert years["total"] and all(2015 <= r["year"] <= 2018 for r in years["results"])
    assert all(r["language"] == "Korean" for r in get(client, language="Korean")["results"])
    audio_ids = [r["id"] for r in get(client, format="Audiobook")["results"]]
    assert all("|Audiobook|" in Book.objects.get(pk=i).formats_text for i in audio_ids)
    assert all(r["rating"] >= 4 for r in get(client, min_rating=4)["results"])
    priced = get(client, price_min=10, price_max=15)
    assert all(10 <= r["price"] <= 15 for r in priced["results"])


def test_author_filter_and_autocomplete(client, catalogue):
    assert {r["title"] for r in get(client, author="Haruki Murakami")["results"]} >= {"Norwegian Wood", "1Q84"}
    assert client.get("/api/authors", {"q": "h"}).json() == {"results": []}
    assert "Han Kang" in client.get("/api/authors", {"q": "han k"}).json()["results"]


def test_invalid_year_range_and_numbers_are_400(client, catalogue):
    assert client.get("/api/books", {"year_from": 2020, "year_to": 2010}).status_code == 400
    assert client.get("/api/books", {"min_rating": "abc"}).status_code == 400
    assert client.get("/api/books", {"year_from": "x"}).status_code == 400


def test_unknown_values_and_bad_page_fall_back(client, catalogue):
    body = get(client, genre="nope", language="Klingon", sort="foo", page="-1")
    assert body["total"] == 1500 and body["page"] == 1
    last = get(client, page=999)
    assert last["page"] == last["pages"]


@pytest.mark.parametrize(
    "sort, key, reverse",
    [
        ("title", "title", False),
        ("rating", "rating", True),
        ("price", "price", False),
        ("newest", "year", True),
        ("oldest", "year", False),
    ],
)
def test_sorts(client, catalogue, sort, key, reverse):
    values = [r[key] for r in get(client, sort=sort)["results"]]
    assert values == sorted(values, reverse=reverse)


def test_facet_counts_follow_the_current_results(client, catalogue):
    korean = get(client, language="Korean")
    assert korean["facets"]["language"] == {"Korean": korean["total"]}
    assert sum(korean["facets"]["genre"].values()) >= korean["total"]


def test_ids_filter_limits_results(client, catalogue):
    ids = [b.id for b in Book.objects.all()[:3]]
    assert sorted(r["id"] for r in get(client, ids=",".join(map(str, ids)))["results"]) == sorted(ids)


def test_detail_and_similar_books(client, catalogue):
    book = Book.objects.get(title="Dune")
    body = client.get(f"/api/books/{book.id}").json()
    assert body["isbn"] == book.isbn13 and body["series"] == {"name": "Dune", "position": 1, "size": 3}
    assert body["award"] == {"name": "Hugo", "year": 1966}
    assert {f["type"] for f in body["formats"]} and body["pages"] == 612
    assert all("science-fiction" in s["genres"] for s in body["similar"]) and book.id not in [
        s["id"] for s in body["similar"]
    ]
    assert client.get("/api/books/999999").status_code == 404


def test_nl_filter_applies_and_combines_with_panel(client, catalogue):
    nl = json.dumps({"field": "language", "op": "eq", "value": "Korean"})
    body = get(client, nl_filter=nl, in_stock="1")
    assert body["total"] and all(r["language"] == "Korean" and r["inStock"] for r in body["results"])
    tampered = client.get("/api/books", {"nl_filter": json.dumps({"field": "isbn13", "op": "eq", "value": "1"})})
    assert tampered.status_code == 400


def test_translate_endpoint_uses_the_spec_examples(client, catalogue):
    ok = client.post(
        "/api/nl-search/translate",
        {"question": "Korean novels after 2015 under $20 with 4+ stars"},
        content_type="application/json",
    )
    assert ok.status_code == 200
    assert (
        ok.json()["description"]
        == "(language is Korean AND genre is literary-fiction AND published after 2015 AND price under $20 AND rating 4 or more)"
    )
    for question in (
        "what is the weather in Seoul tomorrow",
        "zzz-invalid: books with password x",
        "zzz-too-deep: nested question",
    ):
        assert (
            client.post("/api/nl-search/translate", {"question": question}, content_type="application/json").status_code
            == 422
        )
    assert (
        client.post("/api/nl-search/translate", {"question": "x" * 501}, content_type="application/json").status_code
        == 400
    )


def test_translate_is_rate_limited_per_client(client, catalogue):
    statuses = [
        client.post(
            "/api/nl-search/translate",
            {"question": "fantasy or sci-fi, but not audiobooks"},
            content_type="application/json",
        ).status_code
        for _ in range(11)
    ]
    assert statuses[:10] == [200] * 10 and statuses[10] == 429
    limited = client.post("/api/nl-search/translate", {"question": "x"}, content_type="application/json")
    assert "Too many questions" in limited.json()["detail"] and int(limited["Retry-After"]) >= 1


def test_rate_limits_can_be_turned_off(client, catalogue, settings):
    settings.RATE_LIMITS = False
    codes = {
        client.post("/api/nl-search/translate", {"question": "x"}, content_type="application/json").status_code
        for _ in range(12)
    }
    assert 429 not in codes
