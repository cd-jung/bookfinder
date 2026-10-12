-- Generated from Django migration books.0001_initial. Do not edit; edit the model and re-export.
--
-- Create model Author
--
CREATE TABLE "books_author" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "name" varchar(120) NOT NULL UNIQUE, "book_count" integer NOT NULL);
--
-- Create model Book
--
CREATE TABLE "books_book" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "isbn13" varchar(13) NOT NULL UNIQUE, "title" varchar(200) NOT NULL, "description" text NOT NULL, "author_names" varchar(300) NOT NULL, "authors_text" varchar(320) NOT NULL, "author_count" integer NOT NULL, "genres_text" varchar(80) NOT NULL, "subjects_text" varchar(200) NOT NULL, "language" varchar(20) NOT NULL, "publisher" varchar(120) NOT NULL, "published_date" date NOT NULL, "published_year" integer NOT NULL, "page_count" integer NOT NULL, "formats_text" varchar(60) NOT NULL, "formats_json" text NOT NULL, "min_price" real NOT NULL, "in_stock" bool NOT NULL, "avg_rating" real NOT NULL, "rating_count" integer NOT NULL, "popularity" real NOT NULL, "series_name" varchar(120) NOT NULL, "series_position" integer NULL, "series_size" integer NULL, "award_name" varchar(20) NOT NULL, "award_year" integer NULL, "cover_color" varchar(7) NOT NULL);
CREATE INDEX "books_book_language_58905aba" ON "books_book" ("language");
CREATE INDEX "books_book_published_year_8daa64fe" ON "books_book" ("published_year");
CREATE INDEX "books_book_popularity_c99745d5" ON "books_book" ("popularity");
