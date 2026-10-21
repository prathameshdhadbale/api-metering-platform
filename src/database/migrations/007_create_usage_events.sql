CREATE TABLE usage_events (
    id BIGSERIAL PRIMARY KEY,
    api_key_id INT NOT NULL REFERENCES api_keys(id),
    endpoint VARCHAR NOT NULL,
    status_code INT NOT NULL
        CHECK (status_code BETWEEN 100 AND 599),
    latency_ms INT NOT NULL
        CHECK (latency_ms >= 0),
    admitted BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_usage_events_api_key_created_at
    ON usage_events (api_key_id, created_at);

CREATE INDEX idx_usage_events_created_at
    ON usage_events (created_at);
