
import pool from '../../database/pool.js';
import { createApiKey , revokeApiKey} from './api-keys.service.js';

async function createApiKeyController(req, res) {
    try {
        const { name, planId } = req.body;

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
            !Number.isInteger(planId) ||
            planId <= 0
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
            SELECT id, name, key_prefix, plan_id, status,
                   created_at, expires_at, revoked_at
            FROM api_keys
            WHERE user_id = $1;
        `;
    
        const keyList = await pool.query(sql_query, [req.userId]);
    
        return res.status(200).json(keyList.rows);
    }catch(error){
        return res.status(500).json({error:'Server error'});
    }
}

async function revokeApiKeyController(req,res){
    try{
        const {id} = req.params ;
        if(id<1){
            return res.status(400).json('error key')
        }
    
        const result = await revokeApiKey(id,req.userId) ;
        if(result == null){
            return res.status(404)
        }
        return res.status(200).json(result) ;

    }catch(error){
        return res.status(500).json('error key');
    }

}




export { createApiKeyController, listApiKeys , revokeApiKeyController};
