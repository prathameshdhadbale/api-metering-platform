
import { checkRateLimit } from './rate-limit.service.js';

async function rateLimitMiddleware(req, res, next) {
    try {
        const result = await checkRateLimit(req.keyId);

        // Attach rate-limit information to the request.
        req.rateLimit = result;

        if (!result.allowed) {
            if (result.reason === 'invalid_api_key') {
                return res.status(401).json({
                    error: 'Invalid or inactive API key'
                });
            }

            if (result.reason === 'rate_limit_exceeded') {
                res.set('RateLimit-Limit', String(result.limit));
                res.set('RateLimit-Remaining', '0');
                res.set(
                    'RateLimit-Reset',
                    String(Math.ceil(new Date(result.resetAt).getTime() / 1000))
                );

                return res.status(429).json({
                    error: 'Rate limit exceeded',
                    limit: result.limit,
                    remaining: 0,
                    resetAt: result.resetAt
                });
            }

            return res.status(429).json({
                error: 'Request not allowed'
            });
        }

        // Set headers for an allowed request.
        res.set('RateLimit-Limit', String(result.limit));
        res.set('RateLimit-Remaining', String(result.remaining));
        res.set(
            'RateLimit-Reset',
            String(Math.ceil(new Date(result.resetAt).getTime() / 1000))
        );

        return next();
    } catch (error) {
        console.error('Rate limiting failed:', error);

        return res.status(500).json({
            error: 'Internal server error'
        });
    }
}

export default rateLimitMiddleware;
