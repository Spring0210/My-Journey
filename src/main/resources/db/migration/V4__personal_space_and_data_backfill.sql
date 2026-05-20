-- V4__personal_space_and_data_backfill.sql
-- Wave 1 of the team-KB pivot data migration (see docs/superpowers/specs/2026-05-19-team-kb-mcp-design.md §3.2).
--
-- High-level steps:
--   1. Backfill a Personal Space (+ OWNER membership) for every existing user.
--   2. Carry legacy IDs on `document` temporarily so we can join old->new without
--      relying on fragile (title, date, author) business keys.
--   3. Migrate journal_entry  -> document(JOURNAL)   (in the user's personal space)
--   4. Migrate space_post     -> document(NOTE)      (in the same space, content as body)
--   5. Migrate CSV image_paths/video_paths -> document_attachment rows
--   6. Migrate space_post_comment -> document_comment
--   7. Drop the temporary legacy_* columns.
--
-- Legacy tables are LEFT IN PLACE. A later wave (V5) will DROP them once the
-- application has been running on the new schema and no rollback is needed.

-- ============================================================
-- 1. Personal Space backfill
-- ============================================================

-- Create a personal space for every user that doesn't already have one.
INSERT INTO `space` (name, description, cover_image, invite_code, owner_id, is_personal, created_at, updated_at)
SELECT 'Personal', NULL, NULL, NULL, u.id, b'1', NOW(6), NOW(6)
FROM `user` u
WHERE NOT EXISTS (
    SELECT 1 FROM `space` s
    WHERE s.owner_id = u.id AND s.is_personal = b'1'
);

-- Add OWNER membership for any personal space that doesn't yet have one.
INSERT INTO space_member (space_id, user_id, role, joined_at)
SELECT s.id, s.owner_id, 'OWNER', NOW(6)
FROM `space` s
WHERE s.is_personal = b'1'
  AND NOT EXISTS (
      SELECT 1 FROM space_member m
      WHERE m.space_id = s.id AND m.user_id = s.owner_id
  );

-- ============================================================
-- 2. Temporary legacy-id columns on document
-- ============================================================

-- These columns let us join old_id -> new_id without business-key guesswork
-- during the migration. They are dropped at the end of this script.
ALTER TABLE document ADD COLUMN legacy_journal_id INT NULL;
ALTER TABLE document ADD COLUMN legacy_post_id    INT NULL;

-- ============================================================
-- 3. journal_entry -> document(JOURNAL)
-- ============================================================

-- journal_entry has no created_at column; we approximate created_at/updated_at
-- as midnight UTC of entry_date so ordering across docs is preserved.
INSERT INTO document
    (title, content, doc_type, entry_date, tags,
     space_id, author_id, created_at, updated_at, legacy_journal_id)
SELECT
    COALESCE(NULLIF(TRIM(je.title), ''), 'Untitled'),
    COALESCE(je.content, ''),
    'JOURNAL',
    je.entry_date,
    JSON_ARRAY(),
    ps.id,
    je.user_id,
    TIMESTAMP(je.entry_date),
    TIMESTAMP(je.entry_date),
    je.id
FROM journal_entry je
JOIN `space` ps
  ON ps.owner_id = je.user_id AND ps.is_personal = b'1';

-- ============================================================
-- 4. space_post -> document(NOTE)
-- ============================================================

-- space_post has no title column; derive a short title from the first 80
-- chars of content (or 'Untitled' if content is empty/null).
INSERT INTO document
    (title, content, doc_type, entry_date, tags,
     space_id, author_id, created_at, updated_at, legacy_post_id)
SELECT
    COALESCE(NULLIF(TRIM(LEFT(sp.content, 80)), ''), 'Untitled'),
    COALESCE(sp.content, ''),
    'NOTE',
    NULL,
    JSON_ARRAY(),
    sp.space_id,
    sp.user_id,
    COALESCE(sp.created_at, NOW(6)),
    COALESCE(sp.updated_at, sp.created_at, NOW(6)),
    sp.id
FROM space_post sp;

-- ============================================================
-- 5. CSV attachments -> document_attachment
-- ============================================================
-- image_paths / video_paths are comma-separated Cloudinary URLs on the
-- legacy tables. We convert each CSV to a JSON array and use JSON_TABLE
-- to expand it into one row per URL, preserving position. Cloudinary
-- URLs never contain `"` or `\`, so naive JSON construction is safe.

-- 5a. journal_entry.image_paths
INSERT INTO document_attachment
    (document_id, file_url, original_name, mime_type, size_bytes, position, uploaded_at)
SELECT
    d.id,
    TRIM(jt.path),
    NULL,
    CASE
        WHEN LOWER(TRIM(jt.path)) REGEXP '\\.(jpg|jpeg)$' THEN 'image/jpeg'
        WHEN LOWER(TRIM(jt.path)) REGEXP '\\.png$'        THEN 'image/png'
        WHEN LOWER(TRIM(jt.path)) REGEXP '\\.gif$'        THEN 'image/gif'
        WHEN LOWER(TRIM(jt.path)) REGEXP '\\.webp$'       THEN 'image/webp'
        WHEN LOWER(TRIM(jt.path)) REGEXP '\\.mp4$'        THEN 'video/mp4'
        WHEN LOWER(TRIM(jt.path)) REGEXP '\\.(mov|qt)$'   THEN 'video/quicktime'
        ELSE NULL
    END,
    NULL,
    jt.pos - 1,
    d.created_at
FROM document d
JOIN journal_entry je ON je.id = d.legacy_journal_id
JOIN JSON_TABLE(
    CONCAT('["', REPLACE(je.image_paths, ',', '","'), '"]'),
    '$[*]' COLUMNS (path VARCHAR(512) PATH '$', pos FOR ORDINALITY)
) jt
  ON TRIM(jt.path) <> ''
WHERE je.image_paths IS NOT NULL AND je.image_paths <> '';

-- 5b. space_post.image_paths
INSERT INTO document_attachment
    (document_id, file_url, original_name, mime_type, size_bytes, position, uploaded_at)
SELECT
    d.id,
    TRIM(jt.path),
    NULL,
    CASE
        WHEN LOWER(TRIM(jt.path)) REGEXP '\\.(jpg|jpeg)$' THEN 'image/jpeg'
        WHEN LOWER(TRIM(jt.path)) REGEXP '\\.png$'        THEN 'image/png'
        WHEN LOWER(TRIM(jt.path)) REGEXP '\\.gif$'        THEN 'image/gif'
        WHEN LOWER(TRIM(jt.path)) REGEXP '\\.webp$'       THEN 'image/webp'
        ELSE NULL
    END,
    NULL,
    jt.pos - 1,
    d.created_at
FROM document d
JOIN space_post sp ON sp.id = d.legacy_post_id
JOIN JSON_TABLE(
    CONCAT('["', REPLACE(sp.image_paths, ',', '","'), '"]'),
    '$[*]' COLUMNS (path VARCHAR(512) PATH '$', pos FOR ORDINALITY)
) jt
  ON TRIM(jt.path) <> ''
WHERE sp.image_paths IS NOT NULL AND sp.image_paths <> '';

-- 5c. space_post.video_paths (appended after the image attachments)
INSERT INTO document_attachment
    (document_id, file_url, original_name, mime_type, size_bytes, position, uploaded_at)
SELECT
    d.id,
    TRIM(jt.path),
    NULL,
    CASE
        WHEN LOWER(TRIM(jt.path)) REGEXP '\\.mp4$'      THEN 'video/mp4'
        WHEN LOWER(TRIM(jt.path)) REGEXP '\\.(mov|qt)$' THEN 'video/quicktime'
        WHEN LOWER(TRIM(jt.path)) REGEXP '\\.webm$'     THEN 'video/webm'
        ELSE NULL
    END,
    NULL,
    -- Continue position numbering after existing image attachments for this doc.
    (SELECT COALESCE(MAX(da.position), -1) FROM document_attachment da WHERE da.document_id = d.id) + jt.pos,
    d.created_at
FROM document d
JOIN space_post sp ON sp.id = d.legacy_post_id
JOIN JSON_TABLE(
    CONCAT('["', REPLACE(sp.video_paths, ',', '","'), '"]'),
    '$[*]' COLUMNS (path VARCHAR(512) PATH '$', pos FOR ORDINALITY)
) jt
  ON TRIM(jt.path) <> ''
WHERE sp.video_paths IS NOT NULL AND sp.video_paths <> '';

-- ============================================================
-- 6. space_post_comment -> document_comment
-- ============================================================

INSERT INTO document_comment (document_id, author_id, content, created_at)
SELECT
    d.id,
    spc.author_id,
    spc.content,
    COALESCE(spc.created_at, NOW(6))
FROM space_post_comment spc
JOIN document d ON d.legacy_post_id = spc.post_id;

-- ============================================================
-- 7. Drop temporary legacy-id columns
-- ============================================================

ALTER TABLE document DROP COLUMN legacy_journal_id;
ALTER TABLE document DROP COLUMN legacy_post_id;
