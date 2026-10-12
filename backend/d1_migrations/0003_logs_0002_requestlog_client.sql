-- Generated from Django migration logs.0002_requestlog_client. Do not edit; edit the model and re-export.
--
-- Add field client to requestlog
--
CREATE TABLE "new__logs_requestlog" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "client" varchar(16) NOT NULL, "created_at" datetime NOT NULL, "request_id" varchar(64) NOT NULL, "method" varchar(8) NOT NULL, "path" varchar(300) NOT NULL, "status_code" integer NOT NULL, "duration_ms" real NOT NULL, "level" varchar(5) NOT NULL, "message" varchar(500) NOT NULL, "country" varchar(8) NOT NULL);
INSERT INTO "new__logs_requestlog" ("id", "created_at", "request_id", "method", "path", "status_code", "duration_ms", "level", "message", "country", "client") SELECT "id", "created_at", "request_id", "method", "path", "status_code", "duration_ms", "level", "message", "country", '' FROM "logs_requestlog";
DROP TABLE "logs_requestlog";
ALTER TABLE "new__logs_requestlog" RENAME TO "logs_requestlog";
CREATE INDEX "logs_requestlog_client_f356836c" ON "logs_requestlog" ("client");
CREATE INDEX "logs_requestlog_created_at_66a4d7b9" ON "logs_requestlog" ("created_at");
CREATE INDEX "logs_requestlog_path_1e951954" ON "logs_requestlog" ("path");
CREATE INDEX "logs_requestlog_status_code_89728594" ON "logs_requestlog" ("status_code");
CREATE INDEX "logs_requestlog_level_4979d019" ON "logs_requestlog" ("level");
