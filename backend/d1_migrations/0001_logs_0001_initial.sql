-- Generated from Django migration logs.0001_initial. Do not edit; edit the model and re-export.
--
-- Create model RequestLog
--
CREATE TABLE "logs_requestlog" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "created_at" datetime NOT NULL, "request_id" varchar(64) NOT NULL, "method" varchar(8) NOT NULL, "path" varchar(300) NOT NULL, "status_code" integer NOT NULL, "duration_ms" real NOT NULL, "level" varchar(5) NOT NULL, "message" varchar(500) NOT NULL, "country" varchar(8) NOT NULL);
CREATE INDEX "logs_requestlog_created_at_66a4d7b9" ON "logs_requestlog" ("created_at");
CREATE INDEX "logs_requestlog_path_1e951954" ON "logs_requestlog" ("path");
CREATE INDEX "logs_requestlog_status_code_89728594" ON "logs_requestlog" ("status_code");
CREATE INDEX "logs_requestlog_level_4979d019" ON "logs_requestlog" ("level");
