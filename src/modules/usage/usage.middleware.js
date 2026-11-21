
import { recordUsageEvent } from './usage.service.js';

export default function usageMiddleware(req, res, next) {
  const startedAt = process.hrtime.bigint();
  let recorded = false;

  res.on('finish', async () => {
    if (recorded) return;
    recorded = true;

    // Only log requests for which API-key authentication succeeded.
    if (!req.keyId) return;

    const elapsedNs = process.hrtime.bigint() - startedAt;
    const latencyMs = Math.max(
      0,
      Math.round(Number(elapsedNs) / 1_000_000)
    );

    const admitted = req.requestLimits?.allowed === true;

    try {
      await recordUsageEvent({
        apiKeyId: req.keyId,
        endpoint: req.originalUrl,
        statusCode: res.statusCode,
        latencyMs,
        admitted
      });
    } catch (error) {
      // Logging failure must not alter the API response.
      console.error('Failed to record usage event:', error);
    }
  });

  next();
}
