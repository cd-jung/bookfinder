"""Cloudflare Python Worker entry point: hands every request to Django's WSGI app."""

import os

from workers import WorkerEntrypoint

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

from django_cf import DjangoCF  # noqa: E402

from config.wsgi import application  # noqa: E402


class Default(DjangoCF, WorkerEntrypoint):
    def get_app(self):
        return application
