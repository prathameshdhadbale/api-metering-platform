import pool from './pool.js'
import fs from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const currentFile = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFile);
const seedsDirectory = path.join(currentDirectory,'seeds');

async function main(){
    const files = (await fs.readdir(seedsDirectory))
        .filter(file => file.endsWith('.sql'))
        .sort();
    
    for(const file of files){
        const filepath = path.join(seedsDirectory,file);
        const sql = await fs.readFile(filepath,'utf-8');

        await pool.query(sql);

        console.log(`Executed seed file ${file}`) ;
    }
}

main()
    .catch(error=>{
        console.error('seed runner failed: ', error.message);
        process.exitCode = 1 ;
    })
    .finally(async ()=>{
        await pool.end();
    });