/**
 * Centralized logging utility for MCP Switch Manager Addon
 */

const winston = require('winston')
const path = require('path')

// Define log levels
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
}

// Define log colors
const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue'
}

// Add colors to winston
winston.addColors(logColors)

// Create log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`
    
    // Add stack trace for errors
    if (stack) {
      log += `\n${stack}`
    }
    
    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      log += `\n${JSON.stringify(meta, null, 2)}`
    }
    
    return log
  })
)

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, stack }) => {
    let log = `${timestamp} ${level}: ${message}`
    if (stack) {
      log += `\n${stack}`
    }
    return log
  })
)

// Create transports
const transports = []

// Console transport (always enabled)
transports.push(
  new winston.transports.Console({
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.NODE_ENV === 'production' ? logFormat : consoleFormat
  })
)

// File transports (only in production or when LOG_TO_FILE is set)
if (process.env.NODE_ENV === 'production' || process.env.LOG_TO_FILE === 'true') {
  const logDir = process.env.LOG_DIR || path.join(process.cwd(), 'logs')
  
  // Ensure log directory exists
  const fs = require('fs')
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true })
  }
  
  // Combined log file
  transports.push(
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      level: 'debug',
      format: logFormat,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5
    })
  )
  
  // Error log file
  transports.push(
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      format: logFormat,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5
    })
  )
  
  // Switch operations log file
  transports.push(
    new winston.transports.File({
      filename: path.join(logDir, 'switch-operations.log'),
      level: 'info',
      format: logFormat,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 10
    })
  )
}

// Create logger instance
const logger = winston.createLogger({
  levels: logLevels,
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports,
  exitOnError: false
})

// Add custom methods for switch operations
logger.switchOperation = (operation, switchId, details) => {
  logger.info(`SWITCH_OP: ${operation}`, {
    operation,
    switchId,
    details,
    timestamp: new Date().toISOString()
  })
}

logger.vlanOperation = (operation, vlanId, switchIds, details) => {
  logger.info(`VLAN_OP: ${operation}`, {
    operation,
    vlanId,
    switchIds,
    details,
    timestamp: new Date().toISOString()
  })
}

logger.diagnosticResult = (type, switchId, result) => {
  logger.info(`DIAGNOSTIC: ${type}`, {
    type,
    switchId,
    result,
    timestamp: new Date().toISOString()
  })
}

logger.configurationChange = (type, switchId, changes) => {
  logger.info(`CONFIG_CHANGE: ${type}`, {
    type,
    switchId,
    changes,
    timestamp: new Date().toISOString()
  })
}

// Add performance timing methods
logger.startTimer = (label) => {
  const start = process.hrtime.bigint()
  return {
    end: () => {
      const end = process.hrtime.bigint()
      const duration = Number(end - start) / 1000000 // Convert to milliseconds
      logger.debug(`TIMER: ${label} completed in ${duration.toFixed(2)}ms`)
      return duration
    }
  }
}

// Handle uncaught exceptions and unhandled rejections
if (process.env.NODE_ENV === 'production') {
  logger.exceptions.handle(
    new winston.transports.File({
      filename: path.join(process.env.LOG_DIR || 'logs', 'exceptions.log')
    })
  )
  
  logger.rejections.handle(
    new winston.transports.File({
      filename: path.join(process.env.LOG_DIR || 'logs', 'rejections.log')
    })
  )
}

module.exports = logger
