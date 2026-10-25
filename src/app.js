import express from 'express' ;
import {registerRouter,loginRouter} from './modules/auth/auth.routes.js'
import authorize from './modules/auth/auth.middleware.js'
import apiKeysRouter from './modules/api-keys/api-keys.routes.js'
import protectedApiKeysRouter from './modules/api-keys/api-keys.protected.routes.js';

const app = express() ;

app.use(express.json()) ;
app.use('/api/auth',registerRouter);
app.use('/api/auth',loginRouter);
app.use('/api/keys', apiKeysRouter);
app.use('/api', protectedApiKeysRouter);

app.get('/api/auth/me',authorize,(req,res)=>{
    return res.status(200).json(req.userId);
});

app.get('/health',(req,res)=>{
    res.status(200).json({
        status: 'ok'
    });
});



export default app ;