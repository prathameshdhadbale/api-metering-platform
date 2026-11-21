import 'dotenv/config';
import express from 'express' ;
import pool from './database/pool.js';
import { config } from './config/env.js';
import {registerRouter,loginRouter} from './modules/auth/auth.routes.js'
import authorize from './modules/auth/auth.middleware.js'
import apiKeysRouter from './modules/api-keys/api-keys.routes.js'
import protectedApiKeysRouter from './modules/api-keys/api-keys.protected.routes.js';
import analyticsRouter from './modules/analytics/analytics.routes.js';
import plansRouter from './modules/plans/plans.routes.js';

const app = express() ;
if (config.trustProxy !== false) app.set('trust proxy', config.trustProxy);

app.disable('x-powered-by');
app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('X-Frame-Options', 'DENY');
    res.set('Referrer-Policy', 'no-referrer');
    res.set('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    next();
});
app.use(express.json({ limit: '16kb' }));
app.use('/api/auth',registerRouter);
app.use('/api/auth',loginRouter);
app.use('/api/keys', apiKeysRouter);
app.use('/api/plans', plansRouter);
app.use('/api', protectedApiKeysRouter);
app.use('/api/analytics', analyticsRouter);

app.get('/api/auth/me',authorize,(req,res)=>{
    return res.status(200).json(req.userId);
});

app.get('/health',(req,res)=>{
    res.status(200).json({
        status: 'ok'
    });
});

app.get('/health/ready', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        return res.status(200).json({ status: 'ready' });
    } catch (error) {
        console.error('Readiness check failed:', error.message);
        return res.status(503).json({ error: 'Service unavailable' });
    }
});

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error.type === 'entity.too.large') {
        return res.status(413).json({ error: 'Request body too large' });
    }
    if (error.type === 'entity.parse.failed') {
        return res.status(400).json({ error: 'Invalid JSON body' });
    }
    console.error('Unhandled request error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
});



export default app ;
