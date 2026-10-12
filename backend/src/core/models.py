from django.db import models


class AiUsage(models.Model):
    """Real Workers AI calls per UTC day (core.llm cost guard, AI_DAILY_LIMIT)."""

    day = models.CharField(max_length=10, unique=True)  # "YYYY-MM-DD" text: D1 date lookups are unreliable
    calls = models.IntegerField(default=0)
