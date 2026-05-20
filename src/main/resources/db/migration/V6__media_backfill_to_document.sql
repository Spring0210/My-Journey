-- V6__media_backfill_to_document.sql
-- Pre-pivot Media rows have source_type ∈ ('JOURNAL','SPACE_POST') and source_id
-- pointing at journal_entry.id / space_post.id. After the V4 backfill those
-- legacy IDs no longer map to anything the new UI knows how to render — the
-- Media library's "View Entry" link sent users to /journal/{legacy} (which
-- now resolves to DocumentDetailPage and 404s) or /spaces/{post.id} (which is
-- mis-treated as a space id).
--
-- V4 created a Document for every legacy row but the legacy_journal_id /
-- legacy_post_id helper columns were dropped at the end of that script, so
-- here we re-derive the mapping via the Cloudinary URL: each DocumentAttachment
-- was inserted with file_url = the legacy CSV entry, so a join on URL recovers
-- the parent document_id.
--
-- A single Media URL can correspond to exactly one DocumentAttachment in this
-- single-tenant setup (Cloudinary public IDs are unique), so this is safe.

UPDATE media m
JOIN document_attachment da ON da.file_url = m.url
SET
    m.source_type = 'DOCUMENT',
    m.source_id   = da.document_id
WHERE m.source_type IN ('JOURNAL', 'SPACE_POST');

-- Any Media row left with the legacy source_type after the join (an orphan —
-- e.g. an attachment whose URL was somehow lost during V4) would still render
-- in the gallery but its View Entry link would 404. Leaving these in place
-- for visibility rather than silently deleting; they can be cleaned up by
-- hand once the gallery confirms they're truly orphans.
