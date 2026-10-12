"""Index docs/user-guide into Vectorize (embeddings) and D1 (GuideChunk rows). Runs in CD.

Incremental: only chunks whose id or content hash changed are re-embedded; chunks that no longer
exist are deleted from both stores. Uses the Cloudflare REST API with CLOUDFLARE_API_TOKEN, so it
needs no Worker deploy. Standard library only.

Usage (from backend/): python3 scripts/index_guide.py [--full]
"""

import json
import os
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REPO = ROOT.parent
sys.path.insert(0, str(ROOT / "src" / "rag"))
from chunking import chunk_directory  # noqa: E402

CONFIG = json.loads((REPO / "project.config.json").read_text())
CF = CONFIG["cloudflare"]
API = f"https://api.cloudflare.com/client/v4/accounts/{CF['accountId']}"
TOKEN = os.environ["CLOUDFLARE_API_TOKEN"]
BATCH = 20


def call(method, path, body=None, content_type="application/json"):
    data = None if body is None else (body if isinstance(body, bytes) else json.dumps(body).encode())
    request = urllib.request.Request(f"{API}{path}", data=data, method=method)
    request.add_header("Authorization", f"Bearer {TOKEN}")
    request.add_header("Content-Type", content_type)
    with urllib.request.urlopen(request, timeout=120) as response:
        payload = json.loads(response.read())
    if not payload.get("success", True):
        raise RuntimeError(f"{method} {path} failed: {payload.get('errors')}")
    return payload.get("result")


def d1(sql, params=None):
    result = call("POST", f"/d1/database/{CF['d1Id']}/query", {"sql": sql, "params": params or []})
    return result[0].get("results", []) if result else []


def embed(texts):
    result = call("POST", f"/ai/run/{CONFIG['ai']['embeddingModel']}", {"text": texts})
    return result.get("data") or result.get("response")


def main(full):
    chunks = chunk_directory(REPO / "docs" / "user-guide")
    current = {c["id"]: c for c in chunks}
    stored = {r["id"]: r["content_hash"] for r in d1("SELECT id, content_hash FROM rag_guidechunk")}
    changed = [c for c in chunks if full or stored.get(c["id"]) != c["content_hash"]]
    removed = [i for i in stored if i not in current]
    index = CF["vectorizeIndex"]

    for start in range(0, len(changed), BATCH):
        batch = changed[start : start + BATCH]
        vectors = embed([f"{c['section']}\n{c['content']}" for c in batch])
        ndjson = "\n".join(
            json.dumps({"id": c["id"], "values": v, "metadata": {"page": c["page"], "section": c["section"]}})
            for c, v in zip(batch, vectors, strict=True)
        )
        call("POST", f"/vectorize/v2/indexes/{index}/upsert", ndjson.encode(), "application/x-ndjson")
        for c in batch:
            d1(
                "INSERT INTO rag_guidechunk (id, page, page_title, section, anchor, content, content_hash, updated_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now')) ON CONFLICT(id) DO UPDATE SET page=excluded.page, "
                "page_title=excluded.page_title, section=excluded.section, anchor=excluded.anchor, "
                "content=excluded.content, content_hash=excluded.content_hash, updated_at=excluded.updated_at",
                [c["id"], c["page"], c["page_title"], c["section"], c["anchor"], c["content"], c["content_hash"]],
            )
    if removed:
        call("POST", f"/vectorize/v2/indexes/{index}/delete_by_ids", {"ids": removed})
        for start in range(0, len(removed), 50):
            ids = removed[start : start + 50]
            d1(f"DELETE FROM rag_guidechunk WHERE id IN ({','.join('?' * len(ids))})", ids)
    print(f"guide index: {len(chunks)} chunks, {len(changed)} embedded, {len(removed)} removed")


if __name__ == "__main__":
    main("--full" in sys.argv)
