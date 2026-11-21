
import pool from '../../database/pool.js';

export async function getUsageSummary(userId) {
  const result = await pool.query(
    `SELECT
       COUNT(*)::int AS total_requests,
       COUNT(*) FILTER (WHERE ue.admitted)::int AS admitted_requests,
       COUNT(*) FILTER (WHERE NOT ue.admitted)::int AS rejected_requests,
       COALESCE(
         ROUND(
           100.0 * COUNT(*) FILTER (WHERE ue.admitted)
           / NULLIF(COUNT(*), 0),
           2
         ),
         0
       ) AS admission_rate_percent
     FROM usage_events ue
     JOIN api_keys ak ON ak.id = ue.api_key_id
     WHERE ak.user_id = $1`,
    [userId]
  );

  return result.rows[0];
}

export async function getDailyUsage(userId, days = 7) {
  const result = await pool.query(
    `WITH date_range AS (
       SELECT generate_series(
         (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date - ($2::int - 1),
         (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date,
         INTERVAL '1 day'
       )::date AS usage_date
     ),
     daily_events AS (
       SELECT
         (ue.created_at AT TIME ZONE 'UTC')::date AS usage_date,
         COUNT(*)::int AS total_requests,
         COUNT(*) FILTER (WHERE ue.admitted)::int AS admitted_requests,
         COUNT(*) FILTER (WHERE NOT ue.admitted)::int AS rejected_requests
       FROM usage_events ue
       JOIN api_keys ak ON ak.id = ue.api_key_id
       WHERE ak.user_id = $1
         AND ue.created_at >= (
           ((CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date - ($2::int - 1))
           AT TIME ZONE 'UTC'
         )
       GROUP BY (ue.created_at AT TIME ZONE 'UTC')::date
     )
     SELECT
       dr.usage_date,
       COALESCE(de.total_requests, 0)::int AS total_requests,
       COALESCE(de.admitted_requests, 0)::int AS admitted_requests,
       COALESCE(de.rejected_requests, 0)::int AS rejected_requests
     FROM date_range dr
     LEFT JOIN daily_events de USING (usage_date)
     ORDER BY dr.usage_date ASC`,
    [userId, days]
  );

  return result.rows;
}

export async function getUsageByApiKey(userId) {
  const result = await pool.query(
    `SELECT
       ak.id AS api_key_id,
       ak.name AS api_key_name,
       ak.key_prefix,
       ak.status,
       COUNT(ue.id)::int AS total_requests,
       COUNT(ue.id) FILTER (WHERE ue.admitted)::int AS admitted_requests,
       COUNT(ue.id) FILTER (WHERE NOT ue.admitted)::int AS rejected_requests
     FROM api_keys ak
     LEFT JOIN usage_events ue ON ue.api_key_id = ak.id
     WHERE ak.user_id = $1
     GROUP BY ak.id, ak.name, ak.key_prefix, ak.status
     ORDER BY total_requests DESC, ak.id ASC`,
    [userId]
  );

  return result.rows;
}

export async function getUsageByEndpoint(userId) {
  const result = await pool.query(
    `SELECT
       ue.endpoint,
       COUNT(*)::int AS total_requests,
       COUNT(*) FILTER (WHERE ue.admitted)::int AS admitted_requests,
       COUNT(*) FILTER (WHERE NOT ue.admitted)::int AS rejected_requests,
       ROUND(AVG(ue.latency_ms), 2) AS average_latency_ms,
       MAX(ue.latency_ms)::int AS max_latency_ms
     FROM usage_events ue
     JOIN api_keys ak ON ak.id = ue.api_key_id
     WHERE ak.user_id = $1
     GROUP BY ue.endpoint
     ORDER BY total_requests DESC, ue.endpoint ASC`,
    [userId]
  );

  return result.rows;
}

export async function getRecentUsage(userId, limit = 10) {
  const result = await pool.query(
    `SELECT ue.id, ue.api_key_id, ak.name AS api_key_name,
            ue.endpoint, ue.status_code, ue.latency_ms, ue.admitted, ue.created_at
     FROM usage_events ue
     JOIN api_keys ak ON ak.id = ue.api_key_id
     WHERE ak.user_id = $1
     ORDER BY ue.created_at DESC, ue.id DESC
     LIMIT $2`,
    [userId, limit]
  );
  return result.rows.map((event) => ({
    id: event.id,
    apiKeyId: event.api_key_id,
    apiKeyName: event.api_key_name,
    endpoint: event.endpoint,
    statusCode: event.status_code,
    latencyMs: event.latency_ms,
    admitted: event.admitted,
    createdAt: event.created_at
  }));
}
