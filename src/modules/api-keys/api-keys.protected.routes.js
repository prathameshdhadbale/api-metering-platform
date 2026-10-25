import express from 'express';
import authenticateApiKey from './api-key-auth.middleware.js';

const router = express.Router();

router.get('/test', authenticateApiKey, (req, res) => {
    return res.status(200).json({
        message: 'API key authenticated successfully',
        apiKeyId: req.keyId,
        ownerId: req.ownerId,
        planId: req.planId
    });
});

export default router;