import express from 'express'
import {registerUser,loginUser} from './auth.controller.js'
import { createInMemoryRateLimiter } from './auth-rate-limit.middleware.js';
import { config } from '../../config/env.js';

const registerRouter = express.Router() ;
const loginRouter = express.Router() ;
const loginRateLimit = createInMemoryRateLimiter({ max: config.authLoginMax, windowMs: 15 * 60 * 1000 });
const registerRateLimit = createInMemoryRateLimiter({ max: config.authRegisterMax, windowMs: 60 * 60 * 1000 });

registerRouter.post('/register', registerRateLimit, registerUser);

loginRouter.post('/login', loginRateLimit, loginUser);

export {registerRouter,loginRouter} ;
