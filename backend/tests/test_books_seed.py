from books.seed import ANCHORS, TODAY, generate


def test_generator_is_deterministic_and_sized():
    books, authors = generate(500)
    again, _ = generate(500)
    assert len(books) == 500 and books == again
    assert len({b["isbn13"] for b in books}) == 500
    assert {a["name"] for a in authors} >= {"Han Kang", "Haruki Murakami", "Frank Herbert"}


def test_rows_are_consistent():
    books, _ = generate(800)
    for b in books:
        assert b["published_date"] <= TODAY
        assert b["published_year"] == b["published_date"].year
        assert b["authors_text"].startswith("|") and b["genres_text"].startswith("|")
        assert 1 <= b["avg_rating"] <= 5
        assert b["min_price"] > 0
    assert books[0]["title"] == ANCHORS[0][0]
    assert any(not b["cover_color"] for b in books), "some books have no cover"
    assert any(not b["in_stock"] for b in books), "some books are out of stock"
    assert any(b["series_name"] for b in books[len(ANCHORS) :]), "generated series exist"
