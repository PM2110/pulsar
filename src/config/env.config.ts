import { z } from 'zod'
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'

const nodeEnv = process.env.NODE_ENV || 'development'
const envPath = path.resolve(process.cwd(), `.env.${nodeEnv}`)

// Only load from file if it exists, otherwise rely on process.env
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath })
} else if (nodeEnv !== 'production') {
  console.warn(`⚠️ Environment file not found at ${envPath}. Using existing process environment.`)
}

const envSchema = z.object({
  PORT: z.string().default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  REFRESH_TOKEN_SECRET: z.string().min(32),
  COOKIE_SECRET: z.string().min(32)
})

const _env = envSchema.safeParse(process.env)

if (!_env.success) {
  console.error('❌ Invalid environment variables:', JSON.stringify(_env.error.format(), null, 2))
  process.exit(1)
}

export const env = _env.data
