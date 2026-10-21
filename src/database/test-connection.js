import pool from './pool.js'

let sql_query = "SELECT NOW();" ;

async function testconnection(){
    try{
        const result = await pool.query(sql_query);
        console.log("databse connection success");
        console.log(result.rows);
    }catch(e){
        console.error("databse connection failed");
    }finally{
        await pool.end()
    }
}


testconnection();