import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { pool } from '../config/db.config.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function migrate() {
  const migrationFile = path.join(__dirname, 'migrations', '001_initial_schema.sql')
  
  try {
    console.log('🚀 Starting database migration...')
    
    const sql = await fs.readFile(migrationFile, 'utf8')
    
    await pool.query(sql)
    
    console.log('✅ Migration completed successfully!')
  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

migrate()
