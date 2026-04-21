import pg from 'pg'
const { Pool } = pg
import { env } from './env.config.js'

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  // Add production pool settings
  max: env.NODE_ENV === 'production' ? 20 : 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err)
  process.exit(-1)
})

export const query = (text: string, params?: any[]) => pool.query(text, params)
