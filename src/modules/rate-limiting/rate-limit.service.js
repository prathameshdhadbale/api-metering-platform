
import pool from '../../database/pool.js';

async function checkRateLimit(apiKeyId) {
    const client = await pool.connect();
    let transactionStarted = false;

    try {
        await client.query('BEGIN');
        transactionStarted = true;

        // Lock the API key so concurrent requests for this key
        // are processed sequentially.
        const keyResult = await client.query(
            `SELECT id, plan_id, status, expires_at
             FROM api_keys
             WHERE id = $1
             FOR UPDATE`,
            [apiKeyId]
        );

        const apiKey = keyResult.rows[0];

        if (
            !apiKey ||
            apiKey.status !== 'active' ||
            (
                apiKey.expires_at &&
                new Date(apiKey.expires_at).getTime() <= Date.now()
            )
        ) {
            await client.query('ROLLBACK');
            transactionStarted = false;

            return {
                allowed: false,
                reason: 'invalid_api_key'
            };
        }

        // Load the rate limit configured for this key's plan.
        const planResult = await client.query(
            `SELECT rate_limit_requests, rate_limit_window_seconds
             FROM plans
             WHERE id = $1`,
            [apiKey.plan_id]
        );

        const plan = planResult.rows[0];

        if (
            !plan ||
            !Number.isInteger(plan.rate_limit_requests) ||
            plan.rate_limit_requests <= 0 ||
            !Number.isInteger(plan.rate_limit_window_seconds) ||
            plan.rate_limit_window_seconds <= 0
        ) {
            throw new Error('Invalid rate limit configuration');
        }

        const limit = plan.rate_limit_requests;
        const windowSeconds = plan.rate_limit_window_seconds;

        // Get the latest window for this API key.
        const windowResult = await client.query(
            `SELECT window_started_at, request_count
             FROM api_key_rate_limit_windows
             WHERE api_key_id = $1
             ORDER BY window_started_at DESC
             LIMIT 1`,
            [apiKey.id]
        );

        const latestWindow = windowResult.rows[0];

        // PostgreSQL determines expiry to avoid timestamp precision issues.
        let windowExpired = true;

        if (latestWindow) {
            const expiryResult = await client.query(
                `SELECT
                    window_started_at,
                    request_count,
                    CURRENT_TIMESTAMP >=
                        window_started_at
                        + ($2 * INTERVAL '1 second') AS expired
                 FROM api_key_rate_limit_windows
                 WHERE api_key_id = $1
                 ORDER BY window_started_at DESC
                 LIMIT 1`,
                [apiKey.id, windowSeconds]
            );

            windowExpired = expiryResult.rows[0].expired;
        }

        let windowStartedAt;
        let requestCount;

        if (!latestWindow || windowExpired) {
            // First request or first request after the prior window expires.
            const newWindowResult = await client.query(
                `INSERT INTO api_key_rate_limit_windows
                    (api_key_id, window_started_at, request_count)
                 VALUES ($1, clock_timestamp(), 1)
                 RETURNING window_started_at, request_count`,
                [apiKey.id]
            );

            const newWindow = newWindowResult.rows[0];

            if (!newWindow) {
                throw new Error('Failed to create rate-limit window');
            }

            windowStartedAt = newWindow.window_started_at;
            requestCount = newWindow.request_count;
        } else {
            windowStartedAt = latestWindow.window_started_at;

            // Atomically increment only if the limit has not been reached.
            const updatedResult = await client.query(
                `UPDATE api_key_rate_limit_windows
                 SET request_count = request_count + 1,
                     updated_at = clock_timestamp()
                 WHERE api_key_id = $1
                   AND window_started_at = (
                       SELECT MAX(window_started_at)
                       FROM api_key_rate_limit_windows
                       WHERE api_key_id = $1
                   )
                   AND request_count < $2
                 RETURNING window_started_at, request_count`,
                [apiKey.id, limit]
            );

            const updatedWindow = updatedResult.rows[0];

            if (!updatedWindow) {
                // No counter was incremented. Check the latest count
                // and return a rate-limit rejection.
                const currentResult = await client.query(
                    `SELECT window_started_at, request_count
                     FROM api_key_rate_limit_windows
                     WHERE api_key_id = $1
                     ORDER BY window_started_at DESC
                     LIMIT 1`,
                    [apiKey.id]
                );

                const currentWindow = currentResult.rows[0];

                if (currentWindow && currentWindow.request_count >= limit) {
                    windowStartedAt = currentWindow.window_started_at;

                    await client.query('COMMIT');
                    transactionStarted = false;

                    return {
                        allowed: false,
                        reason: 'rate_limit_exceeded',
                        limit,
                        remaining: 0,
                        windowStartedAt,
                        resetAt: new Date(
                            new Date(windowStartedAt).getTime() +
                            windowSeconds * 1000
                        )
                    };
                }

                throw new Error('Failed to update rate-limit counter');
            }

            windowStartedAt = updatedWindow.window_started_at;
            requestCount = updatedWindow.request_count;
        }

        await client.query('COMMIT');
        transactionStarted = false;

        return {
            allowed: true,
            limit,
            remaining: Math.max(0, limit - requestCount),
            requestCount,
            windowStartedAt,
            resetAt: new Date(
                new Date(windowStartedAt).getTime() +
                windowSeconds * 1000
            )
        };
    } catch (error) {
        if (transactionStarted) {
            try {
                await client.query('ROLLBACK');
            } catch (rollbackError) {
                console.error('Rate-limit rollback failed:', rollbackError);
            }
        }

        throw error;
    } finally {
        client.release();
    }
}

export { checkRateLimit };
