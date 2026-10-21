CREATE TABLE plans(
    id SERIAL PRIMARY KEY ,
    name VARCHAR UNIQUE NOT NULL,
    daily_quota INT NOT NULL CHECK (daily_quota>0),
    rate_limit_requests INT NOT NULL CHECK (rate_limit_requests>0),
    rate_limit_window_seconds INT NOT NULL CHECK (rate_limit_window_seconds>0),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);