import pg from 'pg'
import { env } from './env.config.js'
import { logger } from '../utils/logger.js'

const { Pool } = pg

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  // Add production pool settings
  max: env.NODE_ENV === 'production' ? 20 : 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000, // increased to 5 seconds
})

pool.on('error', (err) => {
  logger.error('Unexpected error on idle client', err, 'DATABASE')
  process.exit(-1)
})

export const query = (text: string, params?: any[]) => pool.query(text, params)

export const getClient = async () => {
  const client = await pool.connect()
  return client
}
