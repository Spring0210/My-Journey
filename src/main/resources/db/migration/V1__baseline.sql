-- V1__baseline.sql
-- Baseline schema as of 2026-05-19 (commit e16c4c1).
-- Reflects the schema produced by JPA ddl-auto=update from the entity
-- classes in com.myjourney.model.
--
-- On existing production DBs: Flyway uses baseline-on-migrate=true to mark
-- this version as applied without running it.
-- On fresh dev/test DBs: this script creates the full schema from scratch.

CREATE TABLE IF NOT EXISTS `user` (
    id INT NOT NULL AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL,
    password VARCHAR(255) NULL,
    email VARCHAR(255) NULL,
    avatar VARCHAR(255) NULL,
    google_id VARCHAR(255) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_user_username (username),
    UNIQUE KEY uk_user_email (email),
    UNIQUE KEY uk_user_google_id (google_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS journal_entry (
    id INT NOT NULL AUTO_INCREMENT,
    title VARCHAR(200) NOT NULL,
    content TEXT NULL,
    entry_date DATE NOT NULL,
    image_paths TEXT NULL,
    user_id INT NOT NULL,
    PRIMARY KEY (id),
    KEY idx_journal_entry_user_id (user_id),
    CONSTRAINT fk_journal_entry_user FOREIGN KEY (user_id) REFERENCES `user`(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `space` (
    id INT NOT NULL AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    description TEXT NULL,
    cover_image VARCHAR(500) NULL,
    invite_code VARCHAR(20) NOT NULL,
    owner_id INT NOT NULL,
    created_at DATETIME(6) NULL,
    updated_at DATETIME(6) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_space_invite_code (invite_code),
    KEY idx_space_owner_id (owner_id),
    CONSTRAINT fk_space_owner FOREIGN KEY (owner_id) REFERENCES `user`(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS space_member (
    id INT NOT NULL AUTO_INCREMENT,
    space_id INT NOT NULL,
    user_id INT NOT NULL,
    role VARCHAR(255) NOT NULL,
    joined_at DATETIME(6) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_space_member_space_user (space_id, user_id),
    KEY idx_space_member_user_id (user_id),
    CONSTRAINT fk_space_member_space FOREIGN KEY (space_id) REFERENCES `space`(id),
    CONSTRAINT fk_space_member_user FOREIGN KEY (user_id) REFERENCES `user`(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS space_post (
    id INT NOT NULL AUTO_INCREMENT,
    space_id INT NOT NULL,
    user_id INT NOT NULL,
    content TEXT NULL,
    image_paths TEXT NULL,
    video_paths TEXT NULL,
    created_at DATETIME(6) NULL,
    updated_at DATETIME(6) NULL,
    PRIMARY KEY (id),
    KEY idx_space_post_space_id (space_id),
    KEY idx_space_post_user_id (user_id),
    CONSTRAINT fk_space_post_space FOREIGN KEY (space_id) REFERENCES `space`(id),
    CONSTRAINT fk_space_post_user FOREIGN KEY (user_id) REFERENCES `user`(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS space_post_comment (
    id INT NOT NULL AUTO_INCREMENT,
    post_id INT NOT NULL,
    author_id INT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME(6) NULL,
    PRIMARY KEY (id),
    KEY idx_space_post_comment_post_id (post_id),
    KEY idx_space_post_comment_author_id (author_id),
    CONSTRAINT fk_space_post_comment_post FOREIGN KEY (post_id) REFERENCES space_post(id),
    CONSTRAINT fk_space_post_comment_author FOREIGN KEY (author_id) REFERENCES `user`(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS space_post_reaction (
    id INT NOT NULL AUTO_INCREMENT,
    post_id INT NOT NULL,
    user_id INT NOT NULL,
    emoji VARCHAR(255) NOT NULL,
    created_at DATETIME(6) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_space_post_reaction_post_user (post_id, user_id),
    KEY idx_space_post_reaction_user_id (user_id),
    CONSTRAINT fk_space_post_reaction_post FOREIGN KEY (post_id) REFERENCES space_post(id),
    CONSTRAINT fk_space_post_reaction_user FOREIGN KEY (user_id) REFERENCES `user`(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notification (
    id INT NOT NULL AUTO_INCREMENT,
    recipient_id INT NOT NULL,
    type VARCHAR(255) NOT NULL,
    actor_username VARCHAR(255) NOT NULL,
    space_id INT NULL,
    space_name VARCHAR(255) NULL,
    post_id INT NULL,
    is_read BIT(1) NOT NULL,
    created_at DATETIME(6) NULL,
    PRIMARY KEY (id),
    KEY idx_notification_recipient_id (recipient_id),
    CONSTRAINT fk_notification_recipient FOREIGN KEY (recipient_id) REFERENCES `user`(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS refresh_token (
    id BIGINT NOT NULL AUTO_INCREMENT,
    token VARCHAR(255) NOT NULL,
    user_id INT NOT NULL,
    expired_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_refresh_token_token (token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS password_reset_token (
    id INT NOT NULL AUTO_INCREMENT,
    username VARCHAR(255) NOT NULL,
    code VARCHAR(255) NOT NULL,
    expired_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS registration_code (
    id INT NOT NULL AUTO_INCREMENT,
    email VARCHAR(255) NOT NULL,
    code VARCHAR(255) NOT NULL,
    expires_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_registration_code_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS media (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id INT NOT NULL,
    type VARCHAR(16) NOT NULL,
    url VARCHAR(500) NOT NULL,
    source_type VARCHAR(16) NOT NULL,
    source_id BIGINT NOT NULL,
    source_date DATE NOT NULL,
    position INT NOT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    KEY idx_media_user_date (user_id, source_date DESC, id DESC),
    KEY idx_media_user_type_date (user_id, type, source_date DESC, id DESC),
    KEY idx_media_source (source_type, source_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
