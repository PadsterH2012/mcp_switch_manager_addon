/**
 * Global error handler middleware
 */

const logger = require('../utils/logger')

function errorHandler(err, req, res, next) {
  // Log the error
  logger.error('Unhandled error:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  })

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development'

  // Default error response
  let statusCode = 500
  let message = 'Internal Server Error'
  let details = null

  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400
    message = 'Validation Error'
    details = err.message
  } else if (err.name === 'UnauthorizedError') {
    statusCode = 401
    message = 'Unauthorized'
  } else if (err.name === 'ForbiddenError') {
    statusCode = 403
    message = 'Forbidden'
  } else if (err.name === 'NotFoundError') {
    statusCode = 404
    message = 'Not Found'
  } else if (err.code === 'ECONNREFUSED') {
    statusCode = 503
    message = 'Service Unavailable'
    details = 'Unable to connect to switch'
  } else if (err.code === 'ETIMEDOUT') {
    statusCode = 504
    message = 'Gateway Timeout'
    details = 'Switch connection timeout'
  }

  // Prepare error response
  const errorResponse = {
    error: {
      message,
      status: statusCode,
      timestamp: new Date().toISOString()
    }
  }

  // Add details in development or for specific errors
  if (isDevelopment || details) {
    errorResponse.error.details = details || err.message
  }

  if (isDevelopment) {
    errorResponse.error.stack = err.stack
  }

  // Send error response
  res.status(statusCode).json(errorResponse)
}

module.exports = errorHandler
