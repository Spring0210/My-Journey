-- V5__media_source_type_add_document.sql
-- The `media.source_type` column was originally created by Hibernate's
-- ddl-auto as ENUM('JOURNAL','SPACE_POST'). The team-KB pivot adds a new
-- enum value DOCUMENT (see Media.SourceType + MediaSyncService.syncDocument).
-- Trying to insert 'DOCUMENT' against the old ENUM definition fails with
-- "Data truncated for column 'source_type'".
--
-- Widen the column so all three values are accepted. We drop the ENUM in
-- favor of VARCHAR(16) — Spring's @Enumerated(EnumType.STRING) handles the
-- string mapping in Java, and VARCHAR avoids needing another ALTER each time
-- we add an enum value in the future.
ALTER TABLE media
    MODIFY COLUMN source_type VARCHAR(16) NOT NULL;
