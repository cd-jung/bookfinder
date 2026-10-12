import pytest
from django.core.management import call_command

from books.catalog import BOOK_CATALOG, EXAMPLES
from books.models import Book
from books.seed import TODAY
from nlsearch.compiler import FilterValidationError, apply_filter, describe_filter

pytestmark = pytest.mark.django_db
WITH_FILTER = [e for e in EXAMPLES if "expected_filter" in e]


@pytest.fixture(autouse=True)
def catalogue():
    call_command("seed_demo", count=3000, verbosity=0)


def run(node):
    return list(apply_filter(BOOK_CATALOG, Book.objects.all(), node))


@pytest.mark.parametrize("example", WITH_FILTER, ids=lambda e: e["question"])
def test_examples_compile_and_describe_exactly(example):
    run(example["expected_filter"])
    assert describe_filter(BOOK_CATALOG, example["expected_filter"]) == example["expected_description"]


def test_korean_novels_example_returns_only_matching_books():
    books = run(WITH_FILTER[0]["expected_filter"])
    assert books
    for b in books:
        assert b.language == "Korean" and "literary-fiction" in b.genres
        assert b.published_year > 2015 and b.min_price < 20 and b.avg_rating >= 4


def test_or_not_example():
    for b in run(WITH_FILTER[1]["expected_filter"]):
        assert {"fantasy", "science-fiction"} & set(b.genres) and "|Audiobook|" not in b.formats_text


def test_templates():
    assert all(
        b.award_name == "Hugo" and b.award_year >= 2010 and b.in_stock for b in run(WITH_FILTER[2]["expected_filter"])
    )
    for b in run(WITH_FILTER[3]["expected_filter"]):
        assert (TODAY - b.published_date).days <= 90 and b.page_count < 250
    assert {b.title for b in run(WITH_FILTER[4]["expected_filter"])} >= {"The Vegetarian", "Norwegian Wood"}
    assert all(b.series_position == 1 for b in run({"template": "series_book", "params": {"position": "first"}}))
    latest = run({"template": "series_book", "params": {"position": "latest"}})
    assert latest and all(b.series_position == b.series_size for b in latest)
    assert all(b.author_count >= 2 for b in run({"template": "author_count", "params": {"op": "gte", "value": 2}}))
    dune = Book.objects.get(title="Dune")
    similar = run({"template": "similar_to", "params": {"isbn": dune.isbn13}})
    assert similar and dune not in similar and all("science-fiction" in b.genres for b in similar)


@pytest.mark.parametrize(
    "node",
    [
        {"template": "similar_to", "params": {"isbn": "0000000000000"}},
        {"template": "new_release", "params": {"days": 0}},
        {"template": "award_winner", "params": {"award": "Oscar"}},
        {"field": "genre", "op": "eq", "value": "cooking"},
        {"field": "isbn", "op": "icontains", "value": "978"},
    ],
)
def test_invalid_book_filters(node):
    with pytest.raises(FilterValidationError):
        run(node)
