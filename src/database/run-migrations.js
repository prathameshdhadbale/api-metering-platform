import pool from './pool.js'
import fs from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url' 

const currentFile = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFile) ;
const migrationDirectory = path.join(currentDirectory,'migrations');

async function getMigrationFiles(){
    const files=  await fs.readdir(migrationDirectory);
    return files.filter(file => file.endsWith('.sql')).sort();
}

async function main(){
    await pool.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            id SERIAL PRIMARY KEY,
            filename VARCHAR UNIQUE,
            applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
    `);

    const result = await pool.query(`
        SELECT filename FROM schema_migrations;
    `);
    const migrationFiles = await getMigrationFiles() ;
    console.log(migrationFiles)
    console.log(result.rows)

    const appliedMigrationFiles = new Set(
        result.rows.map(row => row.filename)
    );
    const pendingMigration = migrationFiles.filter(
        files => !appliedMigrationFiles.has(files)
    );
    console.log('Pending migrations:', pendingMigration);

    for(const item of pendingMigration){
        const sql_query = await fs.readFile(path.join(migrationDirectory,item), 'utf-8');
        const client = await pool.connect() ;

        try{
            await client.query('BEGIN');
            await client.query(sql_query);
            await client.query(`insert into schema_migrations (filename) VALUES ($1)`,[item]);
            await client.query('COMMIT');

            console.log(`Applied migrations: ${item}`);
            

        }catch(error){
            await client.query('ROLLBACK');
            console.error(`Migration failed: ${item}`, error.message);
            throw error;
        }finally{
            client.release();
        }
    }

}

main()
    .catch(error=>{
        console.log('Migration runner failed: ', error.message);
        process.exitCode = 1 ;
    })
    .finally(async()=>{
        await pool.end() ;
    });


