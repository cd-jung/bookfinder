"""Deterministic BookFinder catalogue generator (10,000 books by default).

Pure Python and seeded, so local runs, E2E and the D1 seed SQL (scripts/export_seed_sql.py) all get
exactly the same rows. A few well-known titles are included as fixed anchors for tests and examples;
their prices, ratings and stock are fictional like the rest of the store, and every description is
generated here (no publisher blurbs).
"""

import json
import random
from datetime import date, timedelta

from books.models import AWARDS, FORMATS, GENRES, tokens

TODAY = date(2026, 10, 12)
DEFAULT_COUNT = 10_000

# (title, authors, language, year, genres, pages, series, position, size, award, subjects)
ANCHORS = [
    (
        "Dune",
        ["Frank Herbert"],
        "English",
        1965,
        ["science-fiction"],
        612,
        "Dune",
        1,
        3,
        ("Hugo", 1966),
        ["desert", "politics", "ecology"],
    ),
    (
        "Dune Messiah",
        ["Frank Herbert"],
        "English",
        1969,
        ["science-fiction"],
        256,
        "Dune",
        2,
        3,
        None,
        ["desert", "politics"],
    ),
    (
        "Children of Dune",
        ["Frank Herbert"],
        "English",
        1976,
        ["science-fiction"],
        444,
        "Dune",
        3,
        3,
        None,
        ["desert", "family"],
    ),
    (
        "The Vegetarian",
        ["Han Kang"],
        "Korean",
        2007,
        ["literary-fiction"],
        188,
        "",
        None,
        None,
        ("Booker", 2016),
        ["family", "identity"],
    ),
    (
        "Human Acts",
        ["Han Kang"],
        "Korean",
        2014,
        ["literary-fiction", "history"],
        218,
        "",
        None,
        None,
        None,
        ["memory", "politics"],
    ),
    (
        "The White Book",
        ["Han Kang"],
        "Korean",
        2016,
        ["literary-fiction"],
        161,
        "",
        None,
        None,
        None,
        ["grief", "memory"],
    ),
    (
        "Greek Lessons",
        ["Han Kang"],
        "Korean",
        2011,
        ["literary-fiction"],
        192,
        "",
        None,
        None,
        None,
        ["language", "identity"],
    ),
    (
        "We Do Not Part",
        ["Han Kang"],
        "Korean",
        2021,
        ["literary-fiction"],
        329,
        "",
        None,
        None,
        None,
        ["memory", "history"],
    ),
    (
        "Norwegian Wood",
        ["Haruki Murakami"],
        "Japanese",
        1987,
        ["literary-fiction", "romance"],
        296,
        "",
        None,
        None,
        None,
        ["love", "grief"],
    ),
    (
        "Kafka on the Shore",
        ["Haruki Murakami"],
        "Japanese",
        2002,
        ["literary-fiction", "fantasy"],
        505,
        "",
        None,
        None,
        None,
        ["dreams", "identity"],
    ),
    (
        "1Q84",
        ["Haruki Murakami"],
        "Japanese",
        2009,
        ["literary-fiction", "fantasy"],
        928,
        "",
        None,
        None,
        None,
        ["dreams", "love"],
    ),
    (
        "Killing Commendatore",
        ["Haruki Murakami"],
        "Japanese",
        2017,
        ["literary-fiction"],
        681,
        "",
        None,
        None,
        None,
        ["art", "dreams"],
    ),
    (
        "Kim Jiyoung, Born 1982",
        ["Cho Nam-joo"],
        "Korean",
        2016,
        ["literary-fiction"],
        176,
        "",
        None,
        None,
        None,
        ["family", "work"],
    ),
    (
        "Almond",
        ["Sohn Won-pyung"],
        "Korean",
        2017,
        ["literary-fiction"],
        264,
        "",
        None,
        None,
        None,
        ["identity", "friendship"],
    ),
    (
        "The Hobbit",
        ["J. R. R. Tolkien"],
        "English",
        1937,
        ["fantasy", "children"],
        310,
        "",
        None,
        None,
        None,
        ["journey", "dragons"],
    ),
    (
        "A Wizard of Earthsea",
        ["Ursula K. Le Guin"],
        "English",
        1968,
        ["fantasy"],
        205,
        "Earthsea",
        1,
        6,
        None,
        ["magic", "journey"],
    ),
    (
        "The Left Hand of Darkness",
        ["Ursula K. Le Guin"],
        "English",
        1969,
        ["science-fiction"],
        304,
        "",
        None,
        None,
        ("Hugo", 1970),
        ["identity", "politics"],
    ),
    (
        "Neuromancer",
        ["William Gibson"],
        "English",
        1984,
        ["science-fiction"],
        271,
        "",
        None,
        None,
        ("Nebula", 1984),
        ["technology", "crime"],
    ),
    (
        "Le Petit Prince",
        ["Antoine de Saint-Exupéry"],
        "French",
        1943,
        ["children", "fantasy"],
        96,
        "",
        None,
        None,
        None,
        ["friendship", "journey"],
    ),
    (
        "Cien años de soledad",
        ["Gabriel García Márquez"],
        "Spanish",
        1967,
        ["literary-fiction"],
        417,
        "",
        None,
        None,
        None,
        ["family", "memory"],
    ),
]

ADJECTIVES = (
    "Silent Hidden Last Golden Broken Distant Crimson Quiet Burning Endless Hollow Bright Lost Northern Secret "
    "Wild Gentle Frozen Shattered Velvet Iron Paper Winter Summer Midnight Salt Glass Silver Forgotten Little"
).split()
NOUNS = (
    "River Garden Kingdom Lighthouse Archive Orchard Harbor Mirror Forest Station Library Compass Island Letter "
    "Promise Season Bridge Tower Engine Atlas Voyage Lantern Map Memory Clock Valley Shore Crown Signal Window"
).split()
PLACES = "Seoul Kyoto Lisbon Prague Busan Avalon Mars Cairo Oslo Lima Marseille Jeju Osaka Hamburg Valencia".split()
SUBJECTS = (
    "family identity memory politics love grief journey magic dragons technology crime space war friendship "
    "dreams art work ecology language desert sea music food science childhood"
).split()
PUBLISHERS = [
    "Northwind Press",
    "Harbor & Finch",
    "Blue Lantern Books",
    "Maple Street Publishing",
    "Odyssey House",
    "Han River Books",
    "Sakura Leaf Press",
    "Rive Gauche Éditions",
    "Casa del Libro Nuevo",
    "Lindenhaus Verlag",
    "Glass Tower Media",
    "Little Acorn Kids",
    "Starfield Publishing",
    "Quiet Hours Press",
    "Atlas & Ink",
]
NAMES = {
    "English": (
        ["James", "Olivia", "Noah", "Emma", "Liam", "Ava", "Ethan", "Mia", "Lucas", "Grace"],
        ["Walker", "Bennett", "Hayes", "Turner", "Brooks", "Carter", "Reed", "Foster", "Hughes", "Price"],
    ),
    "Korean": (
        ["Min-jun", "Seo-yeon", "Ji-ho", "Ha-eun", "Do-yun", "Soo-ah", "Ye-jun", "Ji-woo", "Hyun-woo", "Eun-ji"],
        ["Kim", "Lee", "Park", "Choi", "Jung", "Kang", "Cho", "Yoon", "Jang", "Lim"],
    ),
    "Japanese": (
        ["Haruto", "Yui", "Sota", "Hina", "Ren", "Aoi", "Kaito", "Mio", "Yuto", "Sakura"],
        ["Sato", "Suzuki", "Takahashi", "Tanaka", "Watanabe", "Ito", "Yamamoto", "Nakamura", "Kobayashi", "Kato"],
    ),
    "French": (
        ["Louis", "Camille", "Jules", "Léa", "Hugo", "Chloé", "Arthur", "Manon", "Gabriel", "Inès"],
        ["Martin", "Bernard", "Dubois", "Moreau", "Laurent", "Lefèvre", "Roux", "Fournier", "Girard", "Mercier"],
    ),
    "Spanish": (
        ["Mateo", "Lucía", "Diego", "Sofía", "Pablo", "Valeria", "Hugo", "Martina", "Álvaro", "Elena"],
        ["García", "Martínez", "López", "Sánchez", "Romero", "Navarro", "Torres", "Ruiz", "Díaz", "Vega"],
    ),
    "German": (
        ["Leon", "Mia", "Paul", "Emilia", "Felix", "Hannah", "Jonas", "Lina", "Max", "Clara"],
        ["Müller", "Schmidt", "Schneider", "Fischer", "Weber", "Wagner", "Becker", "Hoffmann", "Koch", "Richter"],
    ),
}
COVER_COLORS = [
    "#1f5fa8",
    "#0e6e4b",
    "#a8441c",
    "#4a3aa7",
    "#b03333",
    "#2f6b00",
    "#7d5200",
    "#a1325f",
    "#52514e",
]  # >= 4.5:1 with white text
DESCRIPTION = {
    "fantasy": "A tale of {subj} and {subj2} in a world where old magic is waking again.",
    "science-fiction": "Set among distant colonies, a story about {subj}, {subj2} and the cost of progress.",
    "mystery": "A detective follows a trail of {subj} and {subj2} through a city that keeps its secrets.",
    "romance": "Two strangers are drawn together by {subj} and kept apart by {subj2}.",
    "literary-fiction": "A quiet, layered novel about {subj}, {subj2} and the people who stay.",
    "history": "A clear account of {subj} and {subj2}, built on letters, archives and first-hand voices.",
    "biography": "The life of a remarkable figure, told through {subj} and {subj2}.",
    "self-help": "Practical steps for {subj} and {subj2}, with exercises for every chapter.",
    "children": "A warm picture of {subj} and {subj2} for young readers and the grown-ups beside them.",
    "poetry": "Short poems on {subj}, {subj2} and the small moments in between.",
}


def _isbn13(n):
    body = f"978{n:09d}"
    check = (10 - sum(int(d) * (1 if i % 2 == 0 else 3) for i, d in enumerate(body)) % 10) % 10
    return body + str(check)


def _formats(rng, page_count):
    chosen = [
        f for f in FORMATS if rng.random() < {"Hardcover": 0.45, "Paperback": 0.75, "eBook": 0.7, "Audiobook": 0.3}[f]
    ]
    if not chosen:
        chosen = ["Paperback"]
    base = 6 + page_count / 40 + rng.uniform(-3, 6)
    factor = {"Hardcover": 1.6, "Paperback": 1.0, "eBook": 0.6, "Audiobook": 1.4}
    result = []
    for kind in chosen:
        in_stock = kind == "eBook" or rng.random() > 0.18
        expected = None if in_stock or rng.random() < 0.5 else (TODAY + timedelta(days=rng.randint(5, 60))).isoformat()
        result.append(
            {
                "type": kind,
                "price": round(max(2.99, base * factor[kind]), 2),
                "inStock": in_stock,
                "expectedDate": expected,
            }
        )
    return result


def _row(rng, n, title, authors, language, year, genres, pages, series, position, size, award, subjects, publisher):
    published = date(year, rng.randint(1, 12), rng.randint(1, 28))
    if published > TODAY:
        published = TODAY - timedelta(days=rng.randint(1, 30))
    formats = _formats(rng, pages)
    rating = round(min(5.0, max(1.0, rng.gauss(3.9, 0.55))), 2)
    rating_count = int(rng.paretovariate(1.2) * 25)
    subj, subj2 = (subjects + rng.sample(SUBJECTS, 2))[:2]
    return {
        "id": n,
        "isbn13": _isbn13(n),
        "title": title,
        "description": DESCRIPTION[genres[0]].format(subj=subj, subj2=subj2),
        "author_names": ", ".join(authors),
        "authors_text": tokens(authors),
        "author_count": len(authors),
        "genres_text": tokens(genres),
        "subjects_text": tokens(subjects),
        "language": language,
        "publisher": publisher,
        "published_date": published,
        "published_year": published.year,
        "page_count": pages,
        "formats_text": tokens([f["type"] for f in formats]),
        "formats_json": json.dumps(formats, separators=(",", ":")),
        "min_price": min(f["price"] for f in formats),
        "in_stock": any(f["inStock"] for f in formats),
        "avg_rating": rating,
        "rating_count": rating_count,
        "popularity": round(rating * (rating_count**0.5), 3),
        "series_name": series,
        "series_position": position,
        "series_size": size,
        "award_name": award[0] if award else "",
        "award_year": award[1] if award else None,
        "cover_color": "" if rng.random() < 0.05 else rng.choice(COVER_COLORS),
    }


def generate(count=DEFAULT_COUNT, seed=42):
    """Return (books, authors): lists of dicts ready for Book(**row) / Author(**row)."""
    rng = random.Random(seed)
    books = []
    for anchor in ANCHORS:
        title, authors, language, year, genres, pages, series, position, size, award, subjects = anchor
        row = _row(
            rng,
            len(books) + 1,
            title,
            authors,
            language,
            year,
            genres,
            pages,
            series,
            position,
            size,
            award,
            subjects,
            rng.choice(PUBLISHERS),
        )
        row["cover_color"] = row["cover_color"] or COVER_COLORS[0]
        row["rating_count"] = max(row["rating_count"], 5000)
        row["popularity"] = round(row["avg_rating"] * row["rating_count"] ** 0.5, 3)
        books.append(row)
    author_pool = {
        lang: [f"{given} {family}" for given in first for family in last] for lang, (first, last) in NAMES.items()
    }
    languages = ["English"] * 5 + ["Korean"] * 2 + ["Japanese", "French", "Spanish", "German"]
    series_open = {}
    while len(books) < count:
        language = rng.choice(languages)
        genre = rng.choice(list(GENRES))
        genres = [genre] + ([rng.choice([g for g in GENRES if g != genre])] if rng.random() < 0.3 else [])
        pattern = rng.random()
        if pattern < 0.45:
            title = f"The {rng.choice(ADJECTIVES)} {rng.choice(NOUNS)}"
        elif pattern < 0.75:
            title = f"{rng.choice(NOUNS)} of {rng.choice(PLACES)}"
        else:
            title = f"{rng.choice(ADJECTIVES)} {rng.choice(NOUNS)}s"
        authors = [rng.choice(author_pool[language])] + (
            [rng.choice(author_pool[language])] if rng.random() < 0.1 else []
        )
        authors = list(dict.fromkeys(authors))
        year = rng.choices([rng.randint(1950, 1999), rng.randint(2000, 2025), 2026], weights=[3, 6, 1])[0]
        pages = rng.randint(32, 160) if genre in ("children", "poetry") else rng.randint(120, 820)
        series, position, size = "", None, None
        if rng.random() < 0.08:
            key = (authors[0], genre)
            if key not in series_open:
                series_open[key] = [f"The {rng.choice(NOUNS)} Cycle", 0, rng.randint(2, 6)]
            entry = series_open[key]
            if entry[1] < entry[2]:
                entry[1] += 1
                series, position, size = entry[0], entry[1], entry[2]
                title = f"{title}: Book {position}"
        award = (rng.choice(AWARDS), max(year, rng.randint(year, min(year + 2, 2026)))) if rng.random() < 0.02 else None
        subjects = rng.sample(SUBJECTS, 2)
        books.append(
            _row(
                rng,
                len(books) + 1,
                title,
                authors,
                language,
                year,
                genres,
                pages,
                series,
                position,
                size,
                award,
                subjects,
                rng.choice(PUBLISHERS),
            )
        )
    counts = {}
    for row in books:
        for name in row["authors_text"].strip("|").split("|"):
            counts[name] = counts.get(name, 0) + 1
    authors = [{"id": i + 1, "name": name, "book_count": c} for i, (name, c) in enumerate(sorted(counts.items()))]
    return books, authors
