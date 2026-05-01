import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { pool } from '../config/db.config.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const migrate = async () => {
  const migrationsDir = path.join(__dirname, 'migrations')

  try {
    console.log('🚀 Starting database migration...')

    // Read all files in migrations directory
    const files = await fs.readdir(migrationsDir)

    // Filter for .sql files and sort them
    const sqlFiles = files
      .filter(f => f.endsWith('.sql'))
      .sort()

    console.log(`📂 Found ${sqlFiles.length} migration files.`)

    for (const file of sqlFiles) {
      console.log(`📄 Executing migration: ${file}`)
      const filePath = path.join(migrationsDir, file)
      const sql = await fs.readFile(filePath, 'utf8')
      await pool.query(sql)
    }

    console.log('✅ All migrations completed successfully!')
  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

migrate()
