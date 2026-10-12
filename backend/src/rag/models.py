from django.db import models


class GuideChunk(models.Model):
    """A section-sized piece of a User Guide page.

    The text lives here and (with its embedding) in Vectorize. Production rows are written by
    backend/scripts/index_guide.py in CD; local / E2E rows by `manage.py index_guide`.
    """

    id = models.CharField(primary_key=True, max_length=200)  # "<page>#<n>"
    page = models.CharField(max_length=120, db_index=True)  # file name without .md
    page_title = models.CharField(max_length=200)
    section = models.CharField(max_length=300)  # "Page > Heading > Sub-heading"
    anchor = models.CharField(max_length=200)  # heading slug, used in the link
    content = models.TextField()
    content_hash = models.CharField(max_length=64)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["page", "id"]

    @property
    def url(self):
        return f"/guide/{self.page}" + (f"#{self.anchor}" if self.anchor else "")


class AnswerFeedback(models.Model):
    """Thumbs up / down on a Help answer (no user identity is stored)."""

    created_at = models.DateTimeField(auto_now_add=True)
    question = models.CharField(max_length=1000)
    answer = models.TextField()
    helpful = models.BooleanField()
    comment = models.CharField(max_length=1000, blank=True, default="")
