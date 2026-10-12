-- Generated from Django migration core.0001_initial. Do not edit; edit the model and re-export.
--
-- Create model AiUsage
--
CREATE TABLE "core_aiusage" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "day" date NOT NULL UNIQUE, "calls" integer NOT NULL);
