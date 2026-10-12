-- Generated from Django migration rag.0003_guidechunk_lang. Do not edit; edit the model and re-export.
--
-- Add field lang to guidechunk
--
CREATE TABLE "new__rag_guidechunk" ("lang" varchar(5) NOT NULL, "id" varchar(200) NOT NULL PRIMARY KEY, "page" varchar(120) NOT NULL, "page_title" varchar(200) NOT NULL, "section" varchar(300) NOT NULL, "anchor" varchar(200) NOT NULL, "content" text NOT NULL, "content_hash" varchar(64) NOT NULL, "updated_at" datetime NOT NULL);
INSERT INTO "new__rag_guidechunk" ("id", "page", "page_title", "section", "anchor", "content", "content_hash", "updated_at", "lang") SELECT "id", "page", "page_title", "section", "anchor", "content", "content_hash", "updated_at", 'en' FROM "rag_guidechunk";
DROP TABLE "rag_guidechunk";
ALTER TABLE "new__rag_guidechunk" RENAME TO "rag_guidechunk";
CREATE INDEX "rag_guidechunk_lang_0b344b84" ON "rag_guidechunk" ("lang");
CREATE INDEX "rag_guidechunk_page_f4155115" ON "rag_guidechunk" ("page");
