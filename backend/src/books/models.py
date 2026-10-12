"""BookFinder catalogue.

Designed for D1 on the Workers Free plan (100k rows written and 5M rows read per day): one wide
`Book` table instead of join tables. Multi-valued attributes are stored as "|a|b|" token text
(`authors_text`, `genres_text`, `formats_text`, `subjects_text`) and matched with LIKE '%|value|%',
which replaces the EXISTS subqueries of the Postgres design. Per-format prices and stock live in
`formats_json`; `min_price` and `in_stock` are denormalised for filtering and sorting.
"""

import json

from django.db import models

GENRES = {
    "fantasy": "Fantasy",
    "science-fiction": "Science fiction",
    "mystery": "Mystery",
    "romance": "Romance",
    "literary-fiction": "Literary fiction",
    "history": "History",
    "biography": "Biography",
    "self-help": "Self-help",
    "children": "Children",
    "poetry": "Poetry",
}
LANGUAGES = ["English", "Korean", "Japanese", "French", "Spanish", "German"]
FORMATS = ["Hardcover", "Paperback", "eBook", "Audiobook"]
AWARDS = ["Booker", "Hugo", "Nebula", "Pulitzer"]


def tokens(values):
    return "|" + "|".join(values) + "|" if values else ""


def untokens(text):
    return [v for v in text.split("|") if v]


class Author(models.Model):
    """Distinct author names, for the author autocomplete."""

    name = models.CharField(max_length=120, unique=True)
    book_count = models.IntegerField(default=0)

    class Meta:
        ordering = ["-book_count", "name"]


class Book(models.Model):
    isbn13 = models.CharField(max_length=13, unique=True)
    title = models.CharField(max_length=200)
    description = models.TextField()
    author_names = models.CharField(max_length=300)  # display: "Han Kang, Deborah Smith"
    authors_text = models.CharField(max_length=320)  # tokens: "|Han Kang|Deborah Smith|"
    author_count = models.IntegerField(default=1)
    genres_text = models.CharField(max_length=80)
    subjects_text = models.CharField(max_length=200, default="")
    language = models.CharField(max_length=20, db_index=True)
    publisher = models.CharField(max_length=120)
    published_date = models.DateField()
    published_year = models.IntegerField(db_index=True)
    page_count = models.IntegerField()
    formats_text = models.CharField(max_length=60)
    formats_json = models.TextField()  # [{"type", "price", "inStock", "expectedDate"}]
    min_price = models.FloatField()
    in_stock = models.BooleanField(default=True)
    avg_rating = models.FloatField()
    rating_count = models.IntegerField()
    popularity = models.FloatField(db_index=True)
    series_name = models.CharField(max_length=120, blank=True, default="")
    series_position = models.IntegerField(null=True)
    series_size = models.IntegerField(null=True)
    award_name = models.CharField(max_length=20, blank=True, default="")
    award_year = models.IntegerField(null=True)
    cover_color = models.CharField(max_length=7, blank=True, default="")  # "" = no cover image

    class Meta:
        ordering = ["-popularity", "id"]

    @property
    def authors(self):
        return untokens(self.authors_text)

    @property
    def genres(self):
        return untokens(self.genres_text)

    @property
    def formats(self):
        return json.loads(self.formats_json)

    def as_card(self):
        return {
            "id": self.id,
            "isbn": self.isbn13,
            "title": self.title,
            "authors": self.authors,
            "year": self.published_year,
            "rating": round(self.avg_rating, 1),
            "ratingCount": self.rating_count,
            "price": round(self.min_price, 2),
            "inStock": self.in_stock,
            "language": self.language,
            "genres": self.genres,
            "coverColor": self.cover_color or None,
        }

    def as_detail(self, lang="en"):
        from books.i18n import description

        return {
            **self.as_card(),
            "description": description(self, lang) if lang != "en" else self.description,
            "pages": self.page_count,
            "publisher": self.publisher,
            "publishedDate": self.published_date.isoformat(),
            "formats": self.formats,
            "series": {"name": self.series_name, "position": self.series_position, "size": self.series_size}
            if self.series_name
            else None,
            "award": {"name": self.award_name, "year": self.award_year} if self.award_name else None,
            "subjects": untokens(self.subjects_text),
        }
