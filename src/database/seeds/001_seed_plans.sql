INSERT INTO plans (
    name,
    daily_quota,
    rate_limit_requests,
    rate_limit_window_seconds
)
VALUES
    ('Free', 1000, 200, 21600),
    ('Premium', 50000, 1000, 21600)
ON CONFLICT (name) DO UPDATE SET
    daily_quota = EXCLUDED.daily_quota,
    rate_limit_requests = EXCLUDED.rate_limit_requests,
    rate_limit_window_seconds = EXCLUDED.rate_limit_window_seconds;
