"""Languages the app supports, and helpers to read the request's language.

The frontend sends `lang` (query string for GET, JSON body for POST). Translatable values in
catalogues are either a plain string (same in every language) or a {lang: text} dict.
"""

import json

LANGUAGES = ("en", "es", "fr", "ko")
DEFAULT = "en"
NAMES = {"en": "English", "es": "Spanish (Español)", "fr": "French (Français)", "ko": "Korean (한국어)"}


def normalize(lang):
    lang = (lang or "").strip().lower()[:2]
    return lang if lang in LANGUAGES else DEFAULT


def request_lang(request):
    if request.method == "GET":
        return normalize(request.GET.get("lang"))
    try:
        body = json.loads(request.body or b"{}")
    except (json.JSONDecodeError, UnicodeDecodeError):
        return DEFAULT
    return normalize(body.get("lang") if isinstance(body, dict) else None)


def pick(value, lang):
    """A translatable value in `lang`, falling back to English."""
    if isinstance(value, dict):
        return value.get(lang) or value.get(DEFAULT) or next(iter(value.values()), "")
    return value
