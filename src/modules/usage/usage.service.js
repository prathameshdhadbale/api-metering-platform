
import pool from '../../database/pool.js';

export async function recordUsageEvent({
  apiKeyId,
  endpoint,
  statusCode,
  latencyMs,
  admitted
}) {
  await pool.query(
    `INSERT INTO usage_events
       (api_key_id, endpoint, status_code, latency_ms, admitted)
     VALUES ($1, $2, $3, $4, $5)`,
    [apiKeyId, endpoint, statusCode, latencyMs, admitted]
  );
}
