-- Create database if not exists
CREATE DATABASE IF NOT EXISTS my_journey;
USE my_journey;

-- Create user table
CREATE TABLE IF NOT EXISTS user (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create journal_entry table
CREATE TABLE IF NOT EXISTS journal_entry (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    entry_date DATE NOT NULL,
    image_paths TEXT,
    user_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);

-- Migration steps for existing tables (run these if upgrading from old version)
-- Step 1: Add new image_paths column
-- ALTER TABLE journal_entry ADD COLUMN IF NOT EXISTS image_paths TEXT;

-- Step 2: Migrate existing data from image_path to image_paths
-- UPDATE journal_entry SET image_paths = image_path WHERE image_path IS NOT NULL AND image_paths IS NULL;

-- Step 3: Drop the old image_path column (run this after confirming migration is successful)
-- ALTER TABLE journal_entry DROP COLUMN IF EXISTS image_path;

-- Create indexes for better performance
CREATE INDEX idx_user_id ON journal_entry(user_id);
CREATE INDEX idx_entry_date ON journal_entry(entry_date);
CREATE INDEX idx_username ON user(username);

-- Create space table
CREATE TABLE IF NOT EXISTS space (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    cover_image VARCHAR(500),
    invite_code VARCHAR(20) UNIQUE NOT NULL,
    owner_id    INT NOT NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES user(id) ON DELETE CASCADE
);

CREATE INDEX idx_space_invite_code ON space(invite_code);
CREATE INDEX idx_space_owner_id ON space(owner_id);

-- Create space_member table
CREATE TABLE IF NOT EXISTS space_member (
    id        INT AUTO_INCREMENT PRIMARY KEY,
    space_id  INT NOT NULL,
    user_id   INT NOT NULL,
    role      ENUM('OWNER', 'MEMBER') NOT NULL DEFAULT 'MEMBER',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (space_id) REFERENCES space(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)  REFERENCES user(id)  ON DELETE CASCADE,
    UNIQUE KEY uk_space_user (space_id, user_id)
);

CREATE INDEX idx_space_member_user_id ON space_member(user_id);

-- Create space_post table
CREATE TABLE IF NOT EXISTS space_post (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    space_id    INT NOT NULL,
    user_id     INT NOT NULL,
    content     TEXT,
    image_paths TEXT,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (space_id) REFERENCES space(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)  REFERENCES user(id)  ON DELETE CASCADE
);

CREATE INDEX idx_space_post_space_id ON space_post(space_id);
CREATE INDEX idx_space_post_user_id ON space_post(user_id);
