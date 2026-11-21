import pool from '../../database/pool.js';

export async function checkRequestLimits(apiKeyId) {
  const client = await pool.connect();
  let inTransaction = false;

  try {
    await client.query('BEGIN');
    inTransaction = true;

    // Serialize admission checks for this API key.
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
      (apiKey.expires_at &&
        new Date(apiKey.expires_at).getTime() <= Date.now())
    ) {
      await client.query('ROLLBACK');
      inTransaction = false;
      return { allowed: false, reason: 'invalid_api_key' };
    }

    const planResult = await client.query(
      `SELECT daily_quota, rate_limit_requests, rate_limit_window_seconds
       FROM plans
       WHERE id = $1`,
      [apiKey.plan_id]
    );

    const plan = planResult.rows[0];

    if (
      !plan ||
      !Number.isSafeInteger(plan.daily_quota) ||
      !Number.isSafeInteger(plan.rate_limit_requests) ||
      !Number.isSafeInteger(plan.rate_limit_window_seconds) ||
      plan.daily_quota <= 0 ||
      plan.rate_limit_requests <= 0 ||
      plan.rate_limit_window_seconds <= 0
    ) {
      throw new Error('Invalid request limits configured for plan');
    }

    // Read today's usage using the UTC calendar date.
    const dailyResult = await client.query(
      `SELECT request_count, usage_date
       FROM api_key_daily_usage
       WHERE api_key_id = $1
         AND usage_date = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date
       FOR UPDATE`,
      [apiKeyId]
    );

    const dailyCount = dailyResult.rows[0]?.request_count ?? 0;

    // Check the daily quota before modifying either counter.
    if (dailyCount >= plan.daily_quota) {
      const resetResult = await client.query(
        `SELECT (
           (((CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date + 1)::timestamp)
           AT TIME ZONE 'UTC'
         ) AS reset_at`
      );

      await client.query('COMMIT');
      inTransaction = false;

      return {
        allowed: false,
        reason: 'daily_quota_exceeded',
        limit: plan.daily_quota,
        remaining: 0,
        resetAt: resetResult.rows[0].reset_at
      };
    }

    // Find this key's latest six-hour window.
    const windowResult = await client.query(
      `SELECT window_started_at, request_count,
              window_started_at
                + ($2 * INTERVAL '1 second') AS reset_at,
              clock_timestamp() >=
                window_started_at
                  + ($2 * INTERVAL '1 second') AS expired
       FROM api_key_rate_limit_windows
       WHERE api_key_id = $1
       ORDER BY window_started_at DESC
       LIMIT 1`,
      [apiKeyId, plan.rate_limit_window_seconds]
    );

    const currentWindow = windowResult.rows[0];
    const windowIsActive = currentWindow && !currentWindow.expired;
    const rateCount = windowIsActive ? currentWindow.request_count : 0;

    if (rateCount >= plan.rate_limit_requests) {
      await client.query('COMMIT');
      inTransaction = false;

      return {
        allowed: false,
        reason: 'rate_limit_exceeded',
        limit: plan.rate_limit_requests,
        remaining: 0,
        resetAt: currentWindow.reset_at
      };
    }

    // Both checks passed. Increment daily usage.
    await client.query(
      `INSERT INTO api_key_daily_usage
            (api_key_id, usage_date, request_count, last_request_at, updated_at)
        VALUES
            ($1, (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date,
            1, clock_timestamp(), clock_timestamp())
        ON CONFLICT (api_key_id, usage_date)
        DO UPDATE SET
            request_count = api_key_daily_usage.request_count + 1,
            last_request_at = clock_timestamp(),
            updated_at = clock_timestamp()`,
      [apiKeyId]
    );

    // Increment the active window or start a new rolling window.
    let updatedWindow;

    if (windowIsActive) {
      const updateResult = await client.query(
        `UPDATE api_key_rate_limit_windows
         SET request_count = request_count + 1,
             updated_at = clock_timestamp()
         WHERE api_key_id = $1
           AND window_started_at = (
             SELECT MAX(window_started_at)
             FROM api_key_rate_limit_windows
             WHERE api_key_id = $1
           )
         RETURNING window_started_at, request_count`,
        [apiKeyId]
      );

      updatedWindow = updateResult.rows[0];

      if (!updatedWindow) {
        throw new Error('Failed to update rate-limit window');
      }
    } else {
      const insertResult = await client.query(
        `INSERT INTO api_key_rate_limit_windows
           (api_key_id, window_started_at, request_count, updated_at)
         VALUES ($1, clock_timestamp(), 1, clock_timestamp())
         RETURNING window_started_at, request_count`,
        [apiKeyId]
      );

      updatedWindow = insertResult.rows[0];
    }

    const dailyRemaining = plan.daily_quota - dailyCount - 1;
    const rateRemaining =
      plan.rate_limit_requests - updatedWindow.request_count;

    const resetResult = await client.query(
      `SELECT (
         (((CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date + 1)::timestamp)
         AT TIME ZONE 'UTC'
       ) AS reset_at`
    );

    const rateResetAt = new Date(updatedWindow.window_started_at);
    rateResetAt.setSeconds(
      rateResetAt.getSeconds() + plan.rate_limit_window_seconds
    );

    await client.query('COMMIT');
    inTransaction = false;

    return {
      allowed: true,
      dailyQuota: {
        limit: plan.daily_quota,
        remaining: dailyRemaining,
        resetAt: resetResult.rows[0].reset_at
      },
      rateLimit: {
        limit: plan.rate_limit_requests,
        remaining: rateRemaining,
        resetAt: rateResetAt.toISOString()
      }
    };
  } catch (error) {
    if (inTransaction) {
      await client.query('ROLLBACK');
    }
    throw error;
  } finally {
    client.release();
  }
}