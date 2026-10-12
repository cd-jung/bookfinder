"""Outbound HTTP from the Worker (Pyodide fetch), for calls without a binding such as the GraphQL API."""

import json


class HttpError(Exception):
    pass


def post_json(url, body, headers=None, timeout_note="request"):
    try:
        from pyodide.ffi import run_sync
        from pyodide.http import pyfetch
    except ImportError as exc:  # not on Workers
        raise HttpError("outbound HTTP is only available on Workers") from exc
    response = run_sync(
        pyfetch(
            url, method="POST", headers={"Content-Type": "application/json", **(headers or {})}, body=json.dumps(body)
        )
    )
    text = run_sync(response.string())
    if not response.ok:
        raise HttpError(f"{timeout_note} failed: HTTP {response.status}")
    return json.loads(text)
