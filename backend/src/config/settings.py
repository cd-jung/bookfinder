"""Django settings.

DJANGO_ENV selects the runtime:
- "workers": Cloudflare Python Workers, D1 through django-cf (set in wrangler.jsonc vars)
- "local":   developer machine and E2E runs, SQLite file
- "test":    pytest, in-memory SQLite
"""

import sys
from pathlib import Path

from core.runtime import setting

BASE_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = BASE_DIR.parent.parent
DJANGO_ENV = "test" if "pytest" in sys.modules else setting("DJANGO_ENV", "local")
ON_WORKERS = DJANGO_ENV == "workers"

SECRET_KEY = setting("DJANGO_SECRET_KEY", "insecure-local-key-only-for-development")
if ON_WORKERS and SECRET_KEY.startswith("insecure-"):
    # Never use the public default in production. CD sets the real secret (backend/scripts/ensure_secret.sh);
    # until then each isolate uses a random key (client hashes are then not stable across isolates).
    import secrets

    print("DJANGO_SECRET_KEY is not set; using a random per-isolate key", file=sys.stderr)
    SECRET_KEY = secrets.token_urlsafe(48)
DEBUG = False
# Unhandled errors go to stderr, which Workers Logs / `wrangler tail` show (Django's default would mail admins).
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "loggers": {"django.request": {"handlers": ["console"], "level": "ERROR"}},
}
ALLOWED_HOSTS = [h.strip() for h in setting("ALLOWED_HOSTS", "*").split(",") if h.strip()]
# Abuse limits: requests are small JSON; refuse big bodies before Django parses them.
DATA_UPLOAD_MAX_MEMORY_SIZE = 64 * 1024
DATA_UPLOAD_MAX_NUMBER_FIELDS = 200
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"
ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
USE_TZ = True
TIME_ZONE = "UTC"

# Kept minimal on purpose: every app adds Worker start-up and per-request CPU time.
INSTALLED_APPS = ["core", "logs", "rag", "books"]
MIDDLEWARE = [
    "core.middleware.CorsMiddleware",  # outermost, so even 429 / 413 responses are readable by the frontend
    "django.middleware.security.SecurityMiddleware",
    "core.middleware.EdgeRateLimitMiddleware",  # before logging: blocked floods cost no D1 writes
    "core.middleware.AdminOnlyMiddleware",  # /api/logs/* only through the Access-protected admin Worker
    "core.middleware.RequestLogMiddleware",
]

if ON_WORKERS:
    DATABASES = {"default": {"ENGINE": "django_cf.db.backends.d1", "CLOUDFLARE_BINDING": "DB"}}
elif DJANGO_ENV == "test":
    DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": ":memory:"}}
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": setting("LOCAL_DB_PATH", str(BASE_DIR.parent / "local.sqlite3")),
        }
    }

APP_NAME = setting("APP_NAME", "My App")
ALLOWED_ORIGINS = [o.strip() for o in setting("ALLOWED_ORIGINS", "http://localhost:5173").split(",") if o.strip()]

# LLM: "real" (Workers AI), "stub" (deterministic fixtures, used by CI and E2E), "down" (always fails)
LLM_MODE = "stub" if DJANGO_ENV == "test" else setting("LLM_MODE", "stub")
LLM_MODEL = setting("LLM_MODEL", "@cf/meta/llama-3.3-70b-instruct-fp8-fast")
EMBEDDING_MODEL = setting("EMBEDDING_MODEL", "@cf/baai/bge-m3")
RAG_TOP_K = int(setting("RAG_TOP_K", "5"))
RAG_MINIMUM_SIMILARITY = float(setting("RAG_MINIMUM_SIMILARITY", "0.5"))
# Per-client limits on AI endpoints (core.ratelimit); E2E turns them off because every test shares one IP.
RATE_LIMITS = setting("RATE_LIMITS", "1") != "0"
# Cost guard: real Workers AI calls (LLM + embeddings) allowed per UTC day across all users.
AI_DAILY_LIMIT = int(setting("AI_DAILY_LIMIT", "500"))
# Shared secret the admin Worker adds to proxied requests (X-Admin-Proxy). Without it on Workers, admin APIs
# are closed; locally and in tests they are open.
ADMIN_PROXY_SECRET = setting("ADMIN_PROXY_SECRET", "")
ADMIN_PATHS = ("/api/logs",)
# Cloudflare GraphQL Analytics (resource headroom on the dashboard): read-only token as a Worker secret.
CF_ANALYTICS_TOKEN = setting("CF_ANALYTICS_TOKEN", "")
CF_ACCOUNT_ID = setting("CF_ACCOUNT_ID", "")
CF_D1_DATABASE_ID = setting("CF_D1_DATABASE_ID", "")
CF_WORKER_NAME = setting("CF_WORKER_NAME", "")
CPU_LIMIT_MS = int(setting("CPU_LIMIT_MS", "5000"))
# Request logs older than this are deleted (a few rows at a time, on ~1 in 200 requests).
LOG_RETENTION_DAYS = int(setting("LOG_RETENTION_DAYS", "14"))
USER_GUIDE_DIR = Path(setting("USER_GUIDE_DIR", str(REPO_ROOT / "docs" / "user-guide")))
