import jwt from 'jsonwebtoken'
import { config } from '../../config/env.js';

function authorize(req,res,next){
    try{
        const authHeader = req.headers.authorization ;
    
        if(!authHeader || !authHeader.startsWith('Bearer ')){
            return res.status(401).json({error:'Authentication required'});
        }
    
        const token = authHeader.split(' ')[1] ;
        const payload = jwt.verify(token, config.jwtSecret, {
            algorithms: ['HS256'],
            issuer: 'api-metering-platform',
            audience: 'api-metering-platform-api'
        });

        req.userId = payload.sub ;
        next() ;

    }catch(error){
        res.status(401).json({error:'Invalid or expired token'});
    }
}



export default authorize ;
