"""Load the User Guide into GuideChunk for local runs and E2E (no embeddings).

Production indexing (with embeddings into Vectorize) is backend/scripts/index_guide.py, run in CD.
"""

from django.conf import settings
from django.core.management.base import BaseCommand

from rag.chunking import chunk_directory
from rag.models import GuideChunk


class Command(BaseCommand):
    help = "Chunk docs/user-guide/*.md into the GuideChunk table"

    def handle(self, *args, **options):
        chunks = chunk_directory(settings.USER_GUIDE_DIR)
        GuideChunk.objects.all().delete()
        GuideChunk.objects.bulk_create(GuideChunk(**c) for c in chunks)
        self.stdout.write(f"Indexed {len(chunks)} chunks from {settings.USER_GUIDE_DIR}")
