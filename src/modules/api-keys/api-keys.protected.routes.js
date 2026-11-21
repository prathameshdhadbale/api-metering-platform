
import { Router } from 'express';
import authenticateApiKey from './api-key-auth.middleware.js';
import quotaMiddleware from '../quotas/quota.middleware.js';
import usageMiddleware from '../usage/usage.middleware.js';

const router = Router();

router.get(
  '/test',
  usageMiddleware,
  authenticateApiKey,
  quotaMiddleware,
  (req, res) => {
    return res.status(200).json({
      message: 'Request accepted',
      apiKeyId: req.keyId,
      ownerId: req.ownerId,
      planId: req.planId,
      rateLimit: req.requestLimits.rateLimit,
      dailyQuota: req.requestLimits.dailyQuota
    });
  }
);

export default router;
