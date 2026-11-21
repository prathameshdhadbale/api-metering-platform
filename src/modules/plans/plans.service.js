import pool from '../../database/pool.js';

export async function listPlans() {
  const result = await pool.query(
    `SELECT id, name, daily_quota, rate_limit_requests, rate_limit_window_seconds
     FROM plans
     ORDER BY daily_quota ASC, id ASC`
  );
  return result.rows.map((plan) => ({
    id: plan.id,
    name: plan.name,
    dailyQuota: plan.daily_quota,
    rateLimit: {
      requests: plan.rate_limit_requests,
      windowSeconds: plan.rate_limit_window_seconds
    }
  }));
}
