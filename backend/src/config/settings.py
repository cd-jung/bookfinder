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
DEBUG = False
ALLOWED_HOSTS = ["*"]
ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
USE_TZ = True
TIME_ZONE = "UTC"

# Kept minimal on purpose: every app adds Worker start-up and per-request CPU time.
INSTALLED_APPS = ["core", "logs", "rag"]
MIDDLEWARE = ["core.middleware.CorsMiddleware", "core.middleware.RequestLogMiddleware"]

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
USER_GUIDE_DIR = Path(setting("USER_GUIDE_DIR", str(REPO_ROOT / "docs" / "user-guide")))
