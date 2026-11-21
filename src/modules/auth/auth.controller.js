
import argon2 from 'argon2'
import pool from '../../database/pool.js'
import createJwtToken from './auth.token.js'

async function registerUser(req,res){
    try{
        const {name,email,password}  = req.body ?? {};
        if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) {
            return res.status(400).json({
                error: 'Name must be between 2 and 100 characters.'
            });
        }

        if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            return res.status(400).json({
                error: 'Enter a valid email address.'
            });
        }

        if (typeof password !== 'string' || password.length < 12 || password.length > 128 || password.trim().length === 0) {
            return res.status(400).json({
                error: 'Password must be 12–128 characters and cannot be only whitespace.'
            });
        }

        const passwordHash = await argon2.hash(password,{
            type: argon2.argon2id,
            timeCost: 3,
            memoryCost: 65536,
            parallelism: 1,
            hashLength: 32
        });
        const sql_query = `
            INSERT INTO users(name,email,password_hash)
            VALUES($1,$2,$3) 
            RETURNING id,name,email,created_at;
        ` ;

        const user = (await pool.query(sql_query , [name.trim() ,email.trim().toLowerCase() , passwordHash])).rows[0] ;

        return res.status(201).json(user);
    }catch(error){
        if(error.code === '23505'){
            return res.status(409).json({error:'Email already registered'});
        }
        console.error('Registration failed:', error.message);
        return res.status(500).json({error:'Internal server error'});
    }
};


async function loginUser(req,res){
    try{
        const {email,password} = req.body ?? {};
        if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            return res.status(400).json({
                error: 'Enter a valid email address.'
            });
        }

        if (typeof password !== 'string' || password.length < 12 || password.length > 128 || password.trim().length === 0) {
            return res.status(400).json({
                error: 'Password must be 12–128 characters and cannot be only whitespace.'
            });
        }

        const sql_query = `
            SELECT * FROM users WHERE email = $1 ;
        `;

        const user = (await pool.query(sql_query,[email.trim().toLowerCase()])).rows[0];

        if(user == null){
            return res.status(401).json({error:'Invalid email or password'});
        }

        const hash_password = await argon2.verify(user.password_hash, password);
        if(!hash_password){
            return res.status(401).json({error:'Invalid email or password'});
        }

        const token = createJwtToken(user.id) ;

        return res.status(200).json({
            id: user.id ,
            email: user.email,
            name: user.name,
            token: token
        });
    }catch(error){
        console.error('Login failed:', error.message);
        return res.status(500).json({error:'Internal server error'}) ;
    }
};

export {registerUser,loginUser} ;

