CREATE TABLE api_keys (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id),
    plan_id INT NOT NULL REFERENCES plans(id),
    name VARCHAR NOT NULL,
    key_prefix VARCHAR NOT NULL,
    key_hash VARCHAR UNIQUE NOT NULL,
    status VARCHAR NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ
);
