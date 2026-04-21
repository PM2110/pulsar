import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { pool } from '../config/db.config.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Runs the database migrations located in the migrations directory.
 * @param closePool Whether to close the database pool after completion. 
 *                  Set to false when running as part of the app startup.
 */
export async function runMigrations(closePool: boolean = true) {
  const migrationFile = path.join(__dirname, 'migrations', '001_initial_schema.sql')
  
  try {
    console.log('🚀 Starting database migration...')
    
    const sql = await fs.readFile(migrationFile, 'utf8')
    
    await pool.query(sql)
    
    console.log('✅ Migration completed successfully!')
  } catch (error) {
    console.error('❌ Migration failed:', error)
    // If it's a standalone script, we exit. 
    // If it's part of the app, we throw to be caught by the server startup.
    if (closePool) {
      process.exit(1)
    }
    throw error
  } finally {
    if (closePool) {
      await pool.end()
    }
  }
}

// Check if script is run directly
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runMigrations(true)
}
