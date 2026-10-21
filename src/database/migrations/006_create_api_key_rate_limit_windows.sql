CREATE TABLE api_key_rate_limit_windows (
    api_key_id INT NOT NULL REFERENCES api_keys(id),
    window_started_at TIMESTAMPTZ NOT NULL,
    request_count INT NOT NULL DEFAULT 0
        CHECK (request_count >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (api_key_id, window_started_at)
);
