
import express from 'express';
import authorize from '../auth/auth.middleware.js';
import { createApiKeyController, listApiKeys ,revokeApiKeyController} from './api-keys.controller.js';

const router = express.Router();

router.post('/', authorize, createApiKeyController);
router.get('/',authorize,listApiKeys);
router.patch('/:id/revoke', authorize, revokeApiKeyController);

export default router;
