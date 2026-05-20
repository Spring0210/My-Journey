-- V2__add_document_tables.sql
-- Team-KB pivot: schema additions for unified Document model + MCP infrastructure.
-- See docs/superpowers/specs/2026-05-19-team-kb-mcp-design.md §3.

-- 1. space: allow NULL invite_code (personal spaces have no invite) + add is_personal
ALTER TABLE `space` MODIFY COLUMN invite_code VARCHAR(20) NULL;
ALTER TABLE `space` ADD COLUMN is_personal BIT(1) NOT NULL DEFAULT b'0';

-- 2. document: unified content entity (journal entries, space posts, future notes)
CREATE TABLE document (
    id BIGINT NOT NULL AUTO_INCREMENT,
    title VARCHAR(255) NOT NULL,
    content MEDIUMTEXT NOT NULL,
    doc_type VARCHAR(32) NOT NULL,
    entry_date DATE NULL,
    tags JSON NOT NULL,
    space_id INT NOT NULL,
    author_id INT NOT NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    KEY idx_document_space (space_id),
    KEY idx_document_author (author_id),
    CONSTRAINT fk_document_space FOREIGN KEY (space_id) REFERENCES `space`(id),
    CONSTRAINT fk_document_author FOREIGN KEY (author_id) REFERENCES `user`(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. document_attachment: files (images, PDFs, etc.) attached to a document
CREATE TABLE document_attachment (
    id BIGINT NOT NULL AUTO_INCREMENT,
    document_id BIGINT NOT NULL,
    file_url VARCHAR(512) NOT NULL,
    original_name VARCHAR(255) NULL,
    mime_type VARCHAR(100) NULL,
    size_bytes BIGINT NULL,
    position INT NOT NULL DEFAULT 0,
    uploaded_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    KEY idx_document_attachment_document (document_id),
    CONSTRAINT fk_document_attachment_document FOREIGN KEY (document_id) REFERENCES document(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. document_comment: comments on a document (any space member can post)
CREATE TABLE document_comment (
    id BIGINT NOT NULL AUTO_INCREMENT,
    document_id BIGINT NOT NULL,
    author_id INT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    KEY idx_document_comment_document (document_id, created_at),
    KEY idx_document_comment_author (author_id),
    CONSTRAINT fk_document_comment_document FOREIGN KEY (document_id) REFERENCES document(id) ON DELETE CASCADE,
    CONSTRAINT fk_document_comment_author FOREIGN KEY (author_id) REFERENCES `user`(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. mcp_api_token: long-lived tokens for external MCP clients (Claude Desktop, Cursor)
CREATE TABLE mcp_api_token (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    prefix VARCHAR(8) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    last_used_at DATETIME(6) NULL,
    expired_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_mcp_api_token_hash (token_hash),
    KEY idx_mcp_api_token_user (user_id),
    CONSTRAINT fk_mcp_api_token_user FOREIGN KEY (user_id) REFERENCES `user`(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. agent_conversation: chat sessions, scoped per (user, space)
CREATE TABLE agent_conversation (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id INT NOT NULL,
    space_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    KEY idx_agent_conversation_user_space (user_id, space_id, updated_at DESC),
    CONSTRAINT fk_agent_conversation_user FOREIGN KEY (user_id) REFERENCES `user`(id) ON DELETE CASCADE,
    CONSTRAINT fk_agent_conversation_space FOREIGN KEY (space_id) REFERENCES `space`(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. agent_message: turns within an agent_conversation (USER / ASSISTANT / TOOL)
CREATE TABLE agent_message (
    id BIGINT NOT NULL AUTO_INCREMENT,
    conversation_id BIGINT NOT NULL,
    role VARCHAR(16) NOT NULL,
    content JSON NOT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    KEY idx_agent_message_conversation (conversation_id, created_at),
    CONSTRAINT fk_agent_message_conversation FOREIGN KEY (conversation_id) REFERENCES agent_conversation(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. mcp_access_log: 30-day rolling audit of MCP tool calls
CREATE TABLE mcp_access_log (
    id BIGINT NOT NULL AUTO_INCREMENT,
    token_id BIGINT NOT NULL,
    tool_name VARCHAR(64) NOT NULL,
    called_at DATETIME(6) NOT NULL,
    success BIT(1) NOT NULL,
    PRIMARY KEY (id),
    KEY idx_mcp_access_log_token_called (token_id, called_at DESC),
    CONSTRAINT fk_mcp_access_log_token FOREIGN KEY (token_id) REFERENCES mcp_api_token(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
