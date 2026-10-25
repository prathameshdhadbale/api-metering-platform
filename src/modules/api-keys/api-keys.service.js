import crypto from 'node:crypto'
import pool from '../../database/pool.js'

function generateApiKey(){
    const apiKey = crypto.randomBytes(32).toString('hex');
    return apiKey ;
}

function hashApiKey(key){
    const hashKey = crypto.createHash('sha256').update(key).digest('hex') ;

    return hashKey
}

async function createApiKey(userId,planId,name){
    const apiKey = generateApiKey() ;
    const hash_key = hashApiKey(apiKey);
    const prefix_key = apiKey.slice(0,8);

    const sql_query = `
        INSERT INTO api_keys (user_id,plan_id,name,key_prefix,key_hash)
        VALUES ($1,$2,$3,$4,$5) RETURNING id,name,key_prefix,plan_id,status,created_at;
    ` ;

    const result = (await pool.query(sql_query,[userId,planId,name,prefix_key,hash_key])).rows[0] ;
    return {result,apiKey} ;
}

async function revokeApiKey(id,userId){
    const sql_query = `
        UPDATE api_keys
        SET status = 'revoked',
            revoked_at = CURRENT_TIMESTAMP
        WHERE id = $1
        AND user_id = $2
        AND status = 'active'
        RETURNING id, name, status, revoked_at;
    `;

    const result = await pool.query(sql_query, [id, userId]);
    return result.rows[0] ?? null;
}


export {hashApiKey, generateApiKey, createApiKey, revokeApiKey} ;