import math
import re
import time

from django.db.models import Case, IntegerField, Max, Min, Q, Value, When
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_POST

from books.catalog import BOOK_CATALOG
from books.models import FORMATS, GENRES, LANGUAGES, Author, Book
from core.i18n import request_lang
from core.ratelimit import rate_limited
from nlsearch.views import examples_response, filter_from_request, translate_response

PAGE_SIZE = 20
SORTS = {
    "relevance": ["-popularity", "id"],
    "newest": ["-published_date", "id"],
    "oldest": ["published_date", "id"],
    "title": ["title", "id"],
    "rating": ["-avg_rating", "-rating_count", "id"],
    "price": ["min_price", "id"],
}
ISBN = re.compile(r"^[\d\s-]{10,17}$")
_facets_cache = {"at": 0.0, "value": None}


@require_GET
def facets(_request):
    """Static facet values for the filter panel; cached per Worker isolate for 10 minutes."""
    if _facets_cache["value"] is None or time.time() - _facets_cache["at"] > 600:
        ranges = Book.objects.aggregate(
            year_min=Min("published_year"),
            year_max=Max("published_year"),
            price_min=Min("min_price"),
            price_max=Max("min_price"),
        )
        _facets_cache["value"] = {
            "genres": [{"slug": slug, "name": name} for slug, name in GENRES.items()],
            "languages": LANGUAGES,
            "formats": FORMATS,
            "yearRange": [ranges["year_min"] or 1950, ranges["year_max"] or 2026],
            "priceRange": [math.floor(ranges["price_min"] or 0), math.ceil(ranges["price_max"] or 100)],
        }
        _facets_cache["at"] = time.time()
    return JsonResponse(_facets_cache["value"])


class ParamError(ValueError):
    pass


def _int(request, name, low=None, high=None):
    raw = request.GET.get(name, "").strip()
    if not raw:
        return None
    try:
        value = int(float(raw))
    except ValueError as exc:
        raise ParamError(f"{name} must be a number") from exc
    if (low is not None and value < low) or (high is not None and value > high):
        raise ParamError(f"{name} is out of range")
    return value


def _float(request, name):
    raw = request.GET.get(name, "").strip()
    if not raw:
        return None
    try:
        return float(raw)
    except ValueError as exc:
        raise ParamError(f"{name} must be a number") from exc


def _list(request, name, allowed):
    values = [v for v in request.GET.get(name, "").split(",") if v]
    return [v for v in values if v in allowed]


def keyword_filter(queryset, keyword):
    """Keyword over title, author, ISBN, publisher and description; an ISBN-looking keyword ranks exact ISBN first."""
    keyword = keyword.strip()[:200]
    if not keyword:
        return queryset, False
    digits = re.sub(r"[\s-]", "", keyword)
    q = (
        Q(title__icontains=keyword)
        | Q(authors_text__icontains=keyword)
        | Q(publisher__icontains=keyword)
        | Q(description__icontains=keyword)
    )
    is_isbn = bool(ISBN.match(keyword)) and digits.isdigit()
    if is_isbn:
        q |= Q(isbn13__contains=digits)
    return queryset.filter(q), is_isbn


def apply_panel_filters(request, queryset):
    genres = _list(request, "genre", GENRES)
    if genres:
        genre_q = Q()
        for genre in genres:
            genre_q |= Q(genres_text__contains=f"|{genre}|")
        queryset = queryset.filter(genre_q)
    author = request.GET.get("author", "").strip()
    if author:
        queryset = queryset.filter(authors_text__icontains=f"|{author}|")
    year_from, year_to = _int(request, "year_from", 0, 3000), _int(request, "year_to", 0, 3000)
    if year_from and year_to and year_from > year_to:
        raise ParamError("year_from must not be after year_to")
    if year_from:
        queryset = queryset.filter(published_year__gte=year_from)
    if year_to:
        queryset = queryset.filter(published_year__lte=year_to)
    language = request.GET.get("language")
    if language in LANGUAGES:
        queryset = queryset.filter(language=language)
    formats = _list(request, "format", FORMATS)
    if formats:
        format_q = Q()
        for kind in formats:
            format_q |= Q(formats_text__contains=f"|{kind}|")
        queryset = queryset.filter(format_q)
    if request.GET.get("in_stock") in ("1", "true"):
        queryset = queryset.filter(in_stock=True)
    min_rating = _float(request, "min_rating")
    if min_rating:
        queryset = queryset.filter(avg_rating__gte=min_rating)
    price_min, price_max = _float(request, "price_min"), _float(request, "price_max")
    if price_min is not None:
        queryset = queryset.filter(min_price__gte=price_min)
    if price_max is not None:
        queryset = queryset.filter(min_price__lte=price_max)
    ids = [int(i) for i in request.GET.get("ids", "").split(",") if i.isdigit()][:100]
    if ids:
        queryset = queryset.filter(pk__in=ids)
    return queryset


def _facet_counts(rows):
    counts = {"genre": {}, "language": {}, "format": {}}
    for genres_text, language, formats_text in rows:
        for genre in genres_text.strip("|").split("|"):
            counts["genre"][genre] = counts["genre"].get(genre, 0) + 1
        counts["language"][language] = counts["language"].get(language, 0) + 1
        for kind in formats_text.strip("|").split("|"):
            counts["format"][kind] = counts["format"].get(kind, 0) + 1
    return counts


@require_GET
def book_list(request):
    queryset, error = filter_from_request(BOOK_CATALOG, request, Book.objects.all())
    if error:
        return error
    try:
        queryset = apply_panel_filters(request, queryset)
        queryset, is_isbn = keyword_filter(queryset, request.GET.get("q", ""))
    except ParamError as exc:
        return JsonResponse({"detail": str(exc)}, status=400)

    # One pass over the matching rows gives both the total and the facet counts (D1 read budget).
    rows = list(queryset.order_by().values_list("genres_text", "language", "formats_text"))
    total = len(rows)
    pages = max(1, math.ceil(total / PAGE_SIZE))
    page = request.GET.get("page", "1")
    page = min(max(1, int(page)), pages) if page.isdigit() else 1
    order = SORTS.get(request.GET.get("sort", "relevance"), SORTS["relevance"])
    if is_isbn:
        digits = re.sub(r"[\s-]", "", request.GET["q"])
        queryset = queryset.annotate(
            isbn_first=Case(When(isbn13=digits, then=Value(0)), default=Value(1), output_field=IntegerField())
        )
        order = ["isbn_first", *order]
    results = queryset.order_by(*order)[(page - 1) * PAGE_SIZE : page * PAGE_SIZE]
    return JsonResponse(
        {
            "total": total,
            "page": page,
            "pages": pages,
            "pageSize": PAGE_SIZE,
            "results": [b.as_card() for b in results],
            "facets": _facet_counts(rows),
        }
    )


@require_GET
def book_detail(request, book_id):
    book = Book.objects.filter(pk=book_id).first()
    if book is None:
        return JsonResponse({"detail": "Book not found"}, status=404)
    similar_q = Q(genres_text__contains=f"|{book.genres[0]}|") & ~Q(pk=book.pk)
    subjects = [s for s in book.subjects_text.strip("|").split("|") if s]
    if subjects:
        subject_q = Q()
        for subject in subjects:
            subject_q |= Q(subjects_text__contains=f"|{subject}|")
        similar_q &= subject_q
    similar = Book.objects.filter(similar_q).order_by("-popularity")[:8]
    return JsonResponse({**book.as_detail(request_lang(request)), "similar": [b.as_card() for b in similar]})


@require_GET
def authors(request):
    query = request.GET.get("q", "").strip()
    if len(query) < 2:
        return JsonResponse({"results": []})
    names = Author.objects.filter(name__icontains=query).values_list("name", flat=True)[:10]
    return JsonResponse({"results": list(names)})


@csrf_exempt
@require_POST
@rate_limited(10)
def nl_translate(request):
    return translate_response(BOOK_CATALOG, request)


@require_GET
def nl_examples(request):
    return examples_response(BOOK_CATALOG, request)
