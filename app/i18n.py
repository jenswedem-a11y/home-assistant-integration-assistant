import json
from pathlib import Path

from fastapi import Request

LOCALES_DIR = Path(__file__).resolve().parent / "locales"
SUPPORTED_LANGUAGES = ("en", "de")
DEFAULT_LANGUAGE = "en"
LANGUAGE_COOKIE = "smartguide_lang"


def _load_catalogs():
    catalogs = {
        lang: json.loads((LOCALES_DIR / f"{lang}.json").read_text(encoding="utf-8"))
        for lang in SUPPORTED_LANGUAGES
    }
    # Missing keys fall back to English.
    fallback = catalogs[DEFAULT_LANGUAGE]
    return {lang: {**fallback, **strings} for lang, strings in catalogs.items()}


CATALOGS = _load_catalogs()


def normalize_language(value):
    code = str(value or "").strip().lower()[:2]
    return code if code in SUPPORTED_LANGUAGES else None


def resolve_language(request: Request) -> str:
    """Pick the UI language: ?lang= > cookie > Accept-Language > English."""
    explicit = normalize_language(request.query_params.get("lang")) or normalize_language(
        request.cookies.get(LANGUAGE_COOKIE)
    )
    if explicit:
        return explicit
    for part in request.headers.get("accept-language", "").split(","):
        lang = normalize_language(part.split(";")[0])
        if lang:
            return lang
    return DEFAULT_LANGUAGE


def t(lang, key, **params):
    text = CATALOGS.get(lang, CATALOGS[DEFAULT_LANGUAGE]).get(key, key)
    return text.format(**params) if params else text


def tn(lang, key, count, **params):
    return t(lang, f"{key}.{'one' if count == 1 else 'other'}", count=count, **params)


def strings(lang):
    return CATALOGS.get(lang, CATALOGS[DEFAULT_LANGUAGE])
