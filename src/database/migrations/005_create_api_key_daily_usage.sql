CREATE TABLE api_key_daily_usage (
    api_key_id INT NOT NULL REFERENCES api_keys(id),
    usage_date DATE NOT NULL,
    request_count INT NOT NULL DEFAULT 0
        CHECK (request_count >= 0),
    last_request_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (api_key_id, usage_date)
);
