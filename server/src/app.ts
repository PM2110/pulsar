import express, { Express } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import { rateLimit } from 'express-rate-limit'
import cookieParser from 'cookie-parser'
import { pinoHttp } from 'pino-http'
import { env } from './config/env.config.js'
import { errorHandler } from './middlewares/errorHandler.middleware.js'
import healthRoutes from './routes/health.route.js'
import jobRoutes from './routes/job.route.js'
import statsRoutes from './routes/stats.route.js'
import seedRoutes from './routes/seed.route.js'
import eventsRoutes from './routes/events.route.js'
import workerRoutes from './routes/worker.route.js'

const app: Express = express()

// Security & Performance Middlewares
app.use(helmet()) // Security headers
app.use(compression()) // Compress responses

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100, // Limit each IP to 100 requests per window
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again after 15 minutes',
})

if (env.NODE_ENV === 'production') {
  app.use(limiter)
}

// Logging
app.use(pinoHttp({
  transport: env.NODE_ENV === 'development'
    ? { target: 'pino-pretty' }
    : undefined
}))

// CORS
app.use(cors({
  origin: env.NODE_ENV === 'production'
    ? (process.env.ALLOWED_ORIGINS?.split(',') || false)
    : true,
  credentials: true
}))

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser(env.COOKIE_SECRET))

// Routes
app.use('/health', healthRoutes)
app.use('/api/jobs', jobRoutes)
app.use('/api/stats', statsRoutes)
app.use('/api/seed', seedRoutes)
app.use('/api/events', eventsRoutes)
app.use('/api/workers', workerRoutes)

// Error Handler (must be last)
app.use(errorHandler)

export { app }
