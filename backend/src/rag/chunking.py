"""Split User Guide Markdown pages into section chunks.

Pure Python (no Django imports) so backend/scripts/index_guide.py can reuse it in CD.
Headings become the section path and the link anchor; the anchor uses the same slug rule as
the frontend (frontend/src/guide/slug.ts), so a chatbot source link lands on the right heading.
"""

import hashlib
import re
from pathlib import Path

TOKEN = re.compile(r"\w+|[^\w\s]")
HEADING = re.compile(r"^(#{1,4})\s+(.+?)\s*#*\s*$")
MAX_TOKENS = 350
OVERLAP_TOKENS = 50


def slugify(text):
    text = re.sub(r"[`*_~\[\]()]", "", text).strip().lower()
    text = re.sub(r"[^\w\s-]", "", text)
    return re.sub(r"\s", "-", text)


def estimate_tokens(text):
    return len(TOKEN.findall(text))


def _blocks(lines):
    block = []
    for line in lines:
        if line.strip():
            block.append(line)
        elif block:
            yield "\n".join(block)
            block = []
    if block:
        yield "\n".join(block)


def _group(blocks):
    """Group blocks up to MAX_TOKENS, repeating trailing blocks up to OVERLAP_TOKENS."""
    chunks, current = [], []
    for block in blocks:
        if current and estimate_tokens("\n\n".join(current + [block])) > MAX_TOKENS:
            chunks.append("\n\n".join(current))
            overlap = []
            for previous in reversed(current):
                if estimate_tokens("\n\n".join([previous] + overlap)) > OVERLAP_TOKENS:
                    break
                overlap.insert(0, previous)
            current = overlap
        current.append(block)
    if current:
        chunks.append("\n\n".join(current))
    return chunks


def chunk_page(page, text):
    """Return [{"id", "page", "page_title", "section", "anchor", "content", "content_hash"}]."""
    lines = text.replace("\r\n", "\n").split("\n")
    page_title = page
    sections = []  # (path list, anchor, lines)
    path, anchor, body = [], "", []
    for line in lines:
        match = HEADING.match(line)
        if match:
            if body:
                sections.append((list(path), anchor, body))
            level, title = len(match.group(1)), match.group(2).strip()
            if level == 1:
                page_title = title
                path, anchor = [title], ""
            else:
                path = path[: level - 1] + [title]
                anchor = slugify(title)
            body = []
        else:
            body.append(line)
    if body:
        sections.append((list(path), anchor, body))

    chunks = []
    for section_path, section_anchor, section_lines in sections:
        for content in _group(_blocks(section_lines)):
            if not content.strip():
                continue
            index = len(chunks)
            chunks.append(
                {
                    "id": f"{page}#{index}",
                    "page": page,
                    "page_title": page_title,
                    "section": " > ".join(section_path) or page_title,
                    "anchor": section_anchor,
                    "content": content.strip(),
                    "content_hash": hashlib.sha256(content.encode()).hexdigest(),
                }
            )
    return chunks


def chunk_directory(directory):
    """Chunk docs/user-guide/<lang>/*.md for every language folder; ids are "<lang>/<page>#<n>"."""
    chunks = []
    for lang_dir in sorted(p for p in Path(directory).iterdir() if p.is_dir()):
        for file in sorted(lang_dir.glob("*.md")):
            for chunk in chunk_page(file.stem, file.read_text(encoding="utf-8")):
                chunks.append({**chunk, "id": f"{lang_dir.name}/{chunk['id']}", "lang": lang_dir.name})
    return chunks
