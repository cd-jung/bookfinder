-- Generated from Django migration rag.0001_initial. Do not edit; edit the model and re-export.
--
-- Create model GuideChunk
--
CREATE TABLE "rag_guidechunk" ("id" varchar(200) NOT NULL PRIMARY KEY, "page" varchar(120) NOT NULL, "page_title" varchar(200) NOT NULL, "section" varchar(300) NOT NULL, "anchor" varchar(200) NOT NULL, "content" text NOT NULL, "content_hash" varchar(64) NOT NULL, "updated_at" datetime NOT NULL);
CREATE INDEX "rag_guidechunk_page_f4155115" ON "rag_guidechunk" ("page");
