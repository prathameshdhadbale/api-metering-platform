export function createInMemoryRateLimiter({
  max,
  windowMs,
  maxBuckets = 10000,
  clock = Date.now
}) {
  const buckets = new Map();
  let requestsSinceSweep = 0;

  return function inMemoryRateLimiter(req, res, next) {
    const now = clock();
    const key = req.ip || req.socket?.remoteAddress || 'unknown';
    let bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      if (buckets.size >= maxBuckets || ++requestsSinceSweep >= 256) {
        requestsSinceSweep = 0;
        for (const [address, entry] of buckets) {
          if (entry.resetAt <= now) buckets.delete(address);
        }
      }
      if (buckets.size >= maxBuckets) {
        const oldestAddress = buckets.keys().next().value;
        if (oldestAddress !== undefined) buckets.delete(oldestAddress);
      }
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;
    const remaining = Math.max(0, max - bucket.count);
    res.set('RateLimit-Limit', String(max));
    res.set('RateLimit-Remaining', String(remaining));
    res.set('RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > max) {
      res.set('Retry-After', String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
      return res.status(429).json({ error: 'Too many authentication attempts' });
    }

    return next();
  };
}
