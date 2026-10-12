from django.db import models


class RequestLog(models.Model):
    """One row per API request, written by core.middleware.RequestLogMiddleware."""

    LEVELS = [("INFO", "INFO"), ("WARN", "WARN"), ("ERROR", "ERROR")]

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    request_id = models.CharField(max_length=64)
    method = models.CharField(max_length=8)
    path = models.CharField(max_length=300, db_index=True)
    status_code = models.IntegerField(db_index=True)
    duration_ms = models.FloatField()
    level = models.CharField(max_length=5, choices=LEVELS, db_index=True)
    message = models.CharField(max_length=500, blank=True, default="")
    country = models.CharField(max_length=8, blank=True, default="")
    client = models.CharField(max_length=16, blank=True, default="", db_index=True)  # salted IP hash

    class Meta:
        ordering = ["-created_at", "-id"]

    def as_dict(self):
        return {
            "id": self.id,
            "createdAt": self.created_at.isoformat(),
            "requestId": self.request_id,
            "method": self.method,
            "path": self.path,
            "statusCode": self.status_code,
            "durationMs": self.duration_ms,
            "level": self.level,
            "message": self.message,
            "country": self.country,
        }
