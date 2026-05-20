-- V7__normalize_legacy_collations.sql
-- Convert pre-Flyway (ddl-auto-created) tables from MySQL 8's default
-- utf8mb4_0900_ai_ci to the project standard utf8mb4_unicode_ci.
--
-- Background: see docs/superpowers/incidents/2026-05-20-document-migration-deploy-incident.md
-- (action item #2). V6 went down in production because `media.url`
-- (utf8mb4_0900_ai_ci, ddl-auto) joined against `document_attachment.file_url`
-- (utf8mb4_unicode_ci, V2-created) -- MySQL error 1267. This migration closes
-- the same class of bug for every other pre-Flyway table so the next cross-
-- table JOIN doesn't repeat the outage.
--
-- Idempotency: on a fresh dev DB built from V1 baseline these tables are
-- already utf8mb4_unicode_ci, so CONVERT is a no-op metadata refresh.
-- On production (and any DB created by the old ddl-auto path) the tables are
-- utf8mb4_0900_ai_ci and CONVERT rewrites them in place. Dataset is small;
-- CONVERT is a metadata + table-copy operation but completes in seconds.
--
-- All known foreign keys are on INT columns (no FK touches a string column),
-- so no FK constraint conflicts. FOREIGN_KEY_CHECKS=0 is set defensively so
-- the migration is safe against future FKs that reference a string column.

SET FOREIGN_KEY_CHECKS = 0;

ALTER TABLE `user`               CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE journal_entry        CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE `space`              CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE space_member         CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE space_post           CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE space_post_comment   CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE space_post_reaction  CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE notification         CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE refresh_token        CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE password_reset_token CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE registration_code    CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE media                CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
