-- V7__add_agent_tables.sql
-- Internal AI Agent (web chat) — see docs/superpowers/specs/2026-05-19-team-kb-mcp-design.md §5.4.
-- Conversations are scoped per (user, space). agent_message stores the verbatim
-- turn record; for ASSISTANT/USER turns content is a JSON {"text": "..."}, and
-- for TOOL turns content is the JSON tool_use / tool_result block array.

CREATE TABLE agent_conversation (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    user_id     INT          NOT NULL,
    space_id    INT          NOT NULL,
    title       VARCHAR(255) NOT NULL DEFAULT 'Untitled',
    created_at  TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at  TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT fk_agent_conv_user  FOREIGN KEY (user_id)  REFERENCES `user`(id)  ON DELETE CASCADE,
    CONSTRAINT fk_agent_conv_space FOREIGN KEY (space_id) REFERENCES `space`(id) ON DELETE CASCADE,
    INDEX idx_agent_conv_user_space_updated (user_id, space_id, updated_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE agent_message (
    id              BIGINT       NOT NULL AUTO_INCREMENT,
    conversation_id BIGINT       NOT NULL,
    role            VARCHAR(16)  NOT NULL,             -- 'USER' | 'ASSISTANT' | 'TOOL'
    content         JSON         NOT NULL,
    created_at      TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT fk_agent_msg_conv FOREIGN KEY (conversation_id) REFERENCES agent_conversation(id) ON DELETE CASCADE,
    INDEX idx_agent_msg_conv_created (conversation_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
