import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { pool } from '../config/db.config.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Main migration runner.
 * Ensures the database schema is up to date by executing pending .sql files.
 * Tracks executed migrations in the 'schema_migrations' table to ensure idempotency.
 */
const migrate = async () => {
  const migrationsDir = path.join(__dirname, 'migrations')

  try {
    console.log('🚀 Starting database migration...')

    // 1. Ensure the tracking table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        executed_at TIMESTAMP DEFAULT NOW()
      )
    `)

    // 2. Scan the migrations directory
    const files = await fs.readdir(migrationsDir)
    const sqlFiles = files
      .filter(f => f.endsWith('.sql'))
      .sort()

    console.log(`📂 Found ${sqlFiles.length} migration files.`)

    // 3. Identify already executed migrations to avoid duplicates
    const { rows } = await pool.query('SELECT version FROM schema_migrations')
    const executedVersions = new Set(rows.map(r => r.version))

    for (const file of sqlFiles) {
      if (executedVersions.has(file)) {
        console.log(`⏩ Skipping executed migration: ${file}`)
        continue
      }

      console.log(`📄 Executing migration: ${file}`)
      const filePath = path.join(migrationsDir, file)
      const sql = await fs.readFile(filePath, 'utf8')
      
      // 4. Use a transaction per migration file to ensure atomic schema updates
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        await client.query(sql)
        // Record the fact that this specific file has been executed
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file])
        await client.query('COMMIT')
      } catch (err) {
        await client.query('ROLLBACK')
        throw err
      } finally {
        client.release()
      }
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
