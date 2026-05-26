import { Request, Response, NextFunction } from 'express'

const colors = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
}

function formatDateTime(date: Date = new Date()): string {
  const pad = (n: number) => n.toString().padStart(2, '0')
  const yyyy = date.getFullYear()
  const mm = pad(date.getMonth() + 1)
  const dd = pad(date.getDate())
  const hh = pad(date.getHours())
  const min = pad(date.getMinutes())
  const ss = pad(date.getSeconds())
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`
}

export const logger = {
  info(message: string, context: string = 'SYSTEM') {
    const time = `${colors.dim}[${formatDateTime()}]${colors.reset}`
    const level = `${colors.blue}[INFO]${colors.reset}`
    const ctx = `${colors.cyan}[${context}]${colors.reset}`
    console.log(`${time} ${level} ${ctx} ${message}`)
  },

  warn(message: string, context: string = 'SYSTEM') {
    const time = `${colors.dim}[${formatDateTime()}]${colors.reset}`
    const level = `${colors.yellow}[WARN]${colors.reset}`
    const ctx = `${colors.cyan}[${context}]${colors.reset}`
    console.warn(`${time} ${level} ${ctx} ${message}`)
  },

  error(message: string, errorOrMessage?: any, context: string = 'SYSTEM') {
    const time = `${colors.dim}[${formatDateTime()}]${colors.reset}`
    const level = `${colors.red}[ERROR]${colors.reset}`
    const ctx = `${colors.cyan}[${context}]${colors.reset}`
    
    let errorSuffix = ''
    if (errorOrMessage) {
      if (errorOrMessage instanceof Error) {
        errorSuffix = ` - ${errorOrMessage.message}`
        if (errorOrMessage.stack) {
          // Put the stack trace in a second line, indented, to preserve one/two liner rule
          errorSuffix += `\n${colors.dim}    Stack: ${errorOrMessage.stack.split('\n').slice(1, 3).join('\n    ')}${colors.reset}`
        }
      } else {
        errorSuffix = ` - ${String(errorOrMessage)}`
      }
    }
    
    console.error(`${time} ${level} ${ctx} ${message}${errorSuffix}`)
  },

  // Express middleware to capture one-liner API logs
  middleware(req: Request, res: Response, next: NextFunction) {
    const start = Date.now()
    let logged = false

    const logResponse = () => {
      if (logged) return
      logged = true

      const duration = Date.now() - start
      const status = res.statusCode
      const isSuccess = status < 400
      const method = req.method
      const url = req.originalUrl || req.url

      // Skip logging successful health checks to avoid docker console pollution
      if (url === '/health' && isSuccess) {
        return
      }

      const errorMsg = res.locals.errorMessage

      if (isSuccess) {
        const statusColor = colors.green
        const durationColor = duration > 500 ? colors.yellow : colors.dim
        logger.info(
          `${method} ${url} - ${statusColor}SUCCESS${colors.reset} (${colors.dim}${status}${colors.reset}) - ${durationColor}${duration}ms${colors.reset}`,
          'API'
        )
      } else {
        const reason = errorMsg ? ` - Reason: ${errorMsg}` : ''
        logger.error(
          `${method} ${url} - ${colors.red}FAILURE${colors.reset} (${colors.dim}${status}${colors.reset}) - ${colors.yellow}${duration}ms${colors.reset}${reason}`,
          null,
          'API'
        )
      }
    }

    res.on('finish', logResponse)
    res.on('close', logResponse)
    next()
  }
}
