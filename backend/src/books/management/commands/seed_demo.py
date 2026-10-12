"""Load the deterministic 10,000-book catalogue into the local database (dev and E2E)."""

from django.core.management.base import BaseCommand

from books.models import Author, Book
from books.seed import DEFAULT_COUNT, generate


class Command(BaseCommand):
    help = "Replace the local catalogue with the generated BookFinder books"

    def add_arguments(self, parser):
        parser.add_argument("--count", type=int, default=DEFAULT_COUNT)

    def handle(self, *args, count, **options):
        books, authors = generate(count)
        Book.objects.all().delete()
        Author.objects.all().delete()
        Book.objects.bulk_create((Book(**row) for row in books), batch_size=500)
        Author.objects.bulk_create((Author(**row) for row in authors), batch_size=500)
        self.stdout.write(f"Seeded {len(books)} books and {len(authors)} authors")
