-- V3__add_document_indexes.sql
-- FULLTEXT + composite indexes for document search and listing.
-- Split from V2 so we can rebuild indexes separately if needed
-- (FULLTEXT in particular can be expensive on large tables).

ALTER TABLE document ADD FULLTEXT INDEX ft_document_title_content (title, content);
ALTER TABLE document ADD INDEX idx_document_space_type_date (space_id, doc_type, entry_date);
ALTER TABLE document ADD INDEX idx_document_author_created (author_id, created_at);
