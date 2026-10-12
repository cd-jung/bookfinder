-- Generated from Django migration rag.0002_answerfeedback. Do not edit; edit the model and re-export.
--
-- Create model AnswerFeedback
--
CREATE TABLE "rag_answerfeedback" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "created_at" datetime NOT NULL, "question" varchar(1000) NOT NULL, "answer" text NOT NULL, "helpful" bool NOT NULL, "comment" varchar(1000) NOT NULL);
