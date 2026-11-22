-- Migration 004: Email & Phone Verification Tokens
-- Supports PostgreSQL and SQLite

CREATE TABLE IF NOT EXISTS verification_tokens (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    channel VARCHAR(16) NOT NULL CHECK(channel IN ('EMAIL', 'PHONE')),
    identifier VARCHAR(255) NOT NULL,
    otp_hash VARCHAR(128) NOT NULL,
    token_value VARCHAR(128) NOT NULL,
    attempts INTEGER DEFAULT 0,
    expires_at VARCHAR(64) NOT NULL,
    created_at VARCHAR(64) NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_verif_tokens_user ON verification_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_verif_tokens_ident ON verification_tokens(identifier);
CREATE INDEX IF NOT EXISTS idx_verif_tokens_val ON verification_tokens(token_value);
