
import { Router } from 'express';
import authenticate from '../auth/auth.middleware.js';

import {
  usageSummary,
  dailyUsage,
  usageByApiKey,
  usageByEndpoint,
  recentUsage
} from './analytics.controller.js';

const router = Router();

router.get('/summary', authenticate, usageSummary);
router.get('/daily', authenticate, dailyUsage);
router.get('/keys', authenticate, usageByApiKey);
router.get('/endpoints', authenticate, usageByEndpoint);
router.get('/recent', authenticate, recentUsage);

export default router;
