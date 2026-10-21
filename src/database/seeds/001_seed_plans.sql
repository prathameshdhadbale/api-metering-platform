INSERT INTO plans (
    name,
    daily_quota,
    rate_limit_requests,
    rate_limit_window_seconds
)
VALUES
    ('Free', 1000, 10, 60),
    ('Premium', 50000, 100, 60)
ON CONFLICT (name) DO NOTHING;