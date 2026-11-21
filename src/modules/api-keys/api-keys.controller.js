
import pool from '../../database/pool.js';
import { createApiKey , revokeApiKey} from './api-keys.service.js';

async function createApiKeyController(req, res) {
    try {
        const { name, planId } = req.body ?? {};

        // Validate API key name
        if (typeof name !== 'string') {
            return res.status(400).json({
                error: 'Name must be a string'
            });
        }

        const trimmedName = name.trim();

        if (trimmedName.length < 3 || trimmedName.length > 50) {
            return res.status(400).json({
                error: 'Name must be between 3 and 50 characters'
            });
        }

        // Validate plan ID
        if (
            !Number.isSafeInteger(planId) ||
            planId <= 0 ||
            planId > 2147483647
        ) {
            return res.status(400).json({
                error: 'planId must be a positive integer'
            });
        }

        // Check whether the plan exists
        const planResult = await pool.query(
            'SELECT id FROM plans WHERE id = $1',
            [planId]
        );

        if (planResult.rowCount === 0) {
            return res.status(400).json({
                error: 'Invalid planId'
            });
        }

        // userId comes from verified JWT middleware
        const userId = req.userId;

        const { result, apiKey } = await createApiKey(
            userId,
            planId,
            trimmedName
        );

        // Return the raw key only once
        return res.status(201).json({
            message: 'API key created successfully',
            key: apiKey,
            apiKeyDetails: result
        });

    } catch (error) {
        console.error('API key creation failed:', error);

        return res.status(500).json({
            error: 'Internal server error'
        });
    }
}



async function listApiKeys(req,res) {
    try{

        const sql_query = `
            SELECT ak.id, ak.name, ak.key_prefix, ak.plan_id, ak.status,
                   ak.created_at, ak.expires_at, ak.revoked_at,
                   p.name AS plan_name,
                   p.daily_quota,
                   p.rate_limit_requests,
                   p.rate_limit_window_seconds,
                   COALESCE(daily.request_count, 0)::int AS daily_used,
                   GREATEST(p.daily_quota - COALESCE(daily.request_count, 0), 0)::int AS daily_remaining,
                   (((((CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date + 1)::timestamp)
                     AT TIME ZONE 'UTC')) AS daily_reset_at,
                   COALESCE(active_window.request_count, 0)::int AS rate_limit_used,
                   GREATEST(p.rate_limit_requests - COALESCE(active_window.request_count, 0), 0)::int AS rate_limit_remaining,
                   active_window.window_started_at
                     + (p.rate_limit_window_seconds * INTERVAL '1 second') AS rate_limit_reset_at
            FROM api_keys ak
            JOIN plans p ON p.id = ak.plan_id
            LEFT JOIN api_key_daily_usage daily
              ON daily.api_key_id = ak.id
             AND daily.usage_date = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date
            LEFT JOIN LATERAL (
              SELECT window_started_at, request_count
              FROM api_key_rate_limit_windows
              WHERE api_key_id = ak.id
                AND window_started_at + (p.rate_limit_window_seconds * INTERVAL '1 second') > clock_timestamp()
              ORDER BY window_started_at DESC
              LIMIT 1
            ) active_window ON true
            WHERE ak.user_id = $1
            ORDER BY ak.created_at DESC, ak.id DESC;
        `;
    
        const keyList = await pool.query(sql_query, [req.userId]);
    
        return res.status(200).json(keyList.rows);
    }catch(error){
        console.error('API key listing failed:', error.message);
        return res.status(500).json({error:'Internal server error'});
    }
}

async function revokeApiKeyController(req,res){
    try{
        const {id} = req.params ;
        const keyId = Number(id);
        if(!/^\d+$/.test(id) || !Number.isSafeInteger(keyId) || keyId < 1 || keyId > 2147483647){
            return res.status(400).json({error:'Invalid API key ID'});
        }
    
        const result = await revokeApiKey(id,req.userId) ;
        if(result == null){
            return res.status(404).json({error:'API key not found'});
        }
        return res.status(200).json(result) ;

    }catch(error){
        console.error('API key revocation failed:', error.message);
        return res.status(500).json({error:'Internal server error'});
    }

}




export { createApiKeyController, listApiKeys , revokeApiKeyController};
