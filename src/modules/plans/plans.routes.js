import { Router } from 'express';
import authenticate from '../auth/auth.middleware.js';
import { getPlans } from './plans.controller.js';

const router = Router();
router.get('/', authenticate, getPlans);

export default router;
