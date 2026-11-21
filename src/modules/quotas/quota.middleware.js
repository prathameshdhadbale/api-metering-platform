import { checkRequestLimits } from './quota.service.js';

export default async function quotaMiddleware(req, res, next) {
  try {
    const result = await checkRequestLimits(req.keyId);

    if (!result.allowed) {
      if (result.reason === 'invalid_api_key') {
        return res.status(401).json({
          error: 'Invalid or inactive API key'
        });
      }

      const isDaily = result.reason === 'daily_quota_exceeded';

      const resetAt = new Date(result.resetAt);
      const resetEpoch = String(Math.ceil(resetAt.getTime() / 1000));
      if (isDaily) {
        res.set('X-Quota-Limit', String(result.limit));
        res.set('X-Quota-Remaining', '0');
        res.set('X-Quota-Reset', resetEpoch);
      } else {
        res.set('X-RateLimit-Limit', String(result.limit));
        res.set('X-RateLimit-Remaining', '0');
        res.set('X-RateLimit-Reset', resetEpoch);
      }

      return res.status(429).json({
        error: isDaily
          ? 'Daily request quota exceeded'
          : 'Rate limit exceeded',
        limit: result.limit,
        remaining: 0,
        resetAt: result.resetAt
      });
    }

    req.requestLimits = result;

    res.set(
      'X-RateLimit-Limit',
      String(result.rateLimit.limit)
    );
    res.set(
      'X-RateLimit-Remaining',
      String(result.rateLimit.remaining)
    );
    res.set(
      'X-RateLimit-Reset',
      String(
        Math.ceil(new Date(result.rateLimit.resetAt).getTime() / 1000)
      )
    );

    res.set('X-Quota-Limit', String(result.dailyQuota.limit));
    res.set('X-Quota-Remaining', String(result.dailyQuota.remaining));
    res.set(
      'X-Quota-Reset',
      String(
        Math.ceil(new Date(result.dailyQuota.resetAt).getTime() / 1000)
      )
    );

    return next();
  } catch (error) {
    console.error('Request limit enforcement failed:', error);
    return res.status(500).json({
      error: 'Internal server error'
    });
  }
}
