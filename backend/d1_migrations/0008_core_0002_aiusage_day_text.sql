-- Generated from Django migration core.0002_aiusage_day_text. Do not edit; edit the model and re-export.
--
-- Alter field day on aiusage
--
CREATE TABLE "new__core_aiusage" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "day" varchar(10) NOT NULL UNIQUE, "calls" integer NOT NULL);
INSERT INTO "new__core_aiusage" ("id", "calls", "day") SELECT "id", "calls", "day" FROM "core_aiusage";
DROP TABLE "core_aiusage";
ALTER TABLE "new__core_aiusage" RENAME TO "core_aiusage";
