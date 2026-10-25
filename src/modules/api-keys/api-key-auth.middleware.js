import pool from '../../database/pool.js'
import {hashApiKey} from './api-keys.service.js'

async function authenticateApiKey(req,res,next){
    try{
        const x_api_key = req.get('x-api-key');
        if(!x_api_key){
            return res.status(401).json('Invalid key');
        }

        const hashkey = hashApiKey(x_api_key);

        const sql = `
            SELECT id,user_id,plan_id,status,expires_at 
            FROM api_keys
            WHERE key_hash = $1 ;
        `;

        const result = (await pool.query(sql,[hashkey])).rows[0] ;
        if(!result){
            return res.status(401).json('Invalid key');
        }

        if(result.status !== 'active' || (result.expires_at !== null && result.expires_at <= new Date())){
            return res.status(401).json('Key Not active');
        }

        req.keyId = result.id ;
        req.ownerId = result.user_id ;
        req.planId = result.plan_id ;

        next() ;


    }catch(err){
        return res.status(500).json('server error');
    }
}



export default authenticateApiKey ;