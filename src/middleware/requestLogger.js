/**
 * Request logging middleware
 */

const logger = require('../utils/logger')

function requestLogger(req, res, next) {
  const startTime = Date.now()
  
  // Log request
  logger.http('Incoming request', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    contentType: req.get('Content-Type'),
    contentLength: req.get('Content-Length')
  })
  
  // Override res.end to log response
  const originalEnd = res.end
  res.end = function(chunk, encoding) {
    const duration = Date.now() - startTime
    
    logger.http('Request completed', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip
    })
    
    originalEnd.call(this, chunk, encoding)
  }
  
  next()
}

module.exports = requestLogger
