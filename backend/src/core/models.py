from django.db import models


class AiUsage(models.Model):
    """Real Workers AI calls per UTC day (core.llm cost guard, AI_DAILY_LIMIT)."""

    day = models.DateField(unique=True)
    calls = models.IntegerField(default=0)
