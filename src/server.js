/**
 * MCP Switch Manager Addon Server
 * Comprehensive network switch management with VLAN automation and real-time diagnostics
 */

const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const compression = require('compression')
const { RateLimiterMemory } = require('rate-limiter-flexible')

const logger = require('./utils/logger')
const config = require('./utils/config')
const mcpRoutes = require('./routes/mcpRoutes')
const healthRoutes = require('./routes/healthRoutes')
const errorHandler = require('./middleware/errorHandler')
const requestLogger = require('./middleware/requestLogger')

// Import core services
const SwitchManagerService = require('./services/SwitchManagerService')
const VLANManagerService = require('./services/vlan/VLANManagerService')
const DiagnosticsService = require('./services/diagnostics/DiagnosticsService')
const ConfigurationService = require('./services/configuration/ConfigurationService')

class MCPSwitchManagerServer {
  constructor() {
    this.app = express()
    this.port = config.port || 8087
    this.services = {}
    this.rateLimiter = new RateLimiterMemory({
      keyGenerator: (req) => req.ip,
      points: 100, // Number of requests
      duration: 60 // Per 60 seconds
    })
  }

  async initialize() {
    try {
      logger.info('🚀 Initializing MCP Switch Manager Addon Server')

      // Initialize core services
      await this.initializeServices()

      // Setup middleware
      this.setupMiddleware()

      // Setup routes
      this.setupRoutes()

      // Setup error handling
      this.setupErrorHandling()

      logger.info('✅ Server initialization completed')
    } catch (error) {
      logger.error('❌ Server initialization failed:', error)
      throw error
    }
  }

  async initializeServices() {
    logger.info('🔧 Initializing core services...')

    try {
      // Initialize Switch Manager Service
      this.services.switchManager = new SwitchManagerService()
      await this.services.switchManager.initialize()
      logger.info('✅ Switch Manager Service initialized')

      // Initialize VLAN Manager Service
      this.services.vlanManager = new VLANManagerService(this.services.switchManager)
      await this.services.vlanManager.initialize()
      logger.info('✅ VLAN Manager Service initialized')

      // Initialize Diagnostics Service
      this.services.diagnostics = new DiagnosticsService(this.services.switchManager)
      await this.services.diagnostics.initialize()
      logger.info('✅ Diagnostics Service initialized')

      // Initialize Configuration Service
      this.services.configuration = new ConfigurationService(this.services.switchManager)
      await this.services.configuration.initialize()
      logger.info('✅ Configuration Service initialized')

      // Make services available globally for MCP tools
      global.mcpServices = this.services

      logger.info('🎯 All core services initialized successfully')
    } catch (error) {
      logger.error('❌ Service initialization failed:', error)
      throw error
    }
  }

  setupMiddleware() {
    logger.info('🛡️ Setting up middleware...')

    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"]
        }
      }
    }))

    // CORS configuration
    this.app.use(cors({
      origin: config.corsOrigins || ['http://localhost:3000'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    }))

    // Compression
    this.app.use(compression())

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }))
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }))

    // Rate limiting middleware
    this.app.use(async (req, res, next) => {
      try {
        await this.rateLimiter.consume(req.ip)
        next()
      } catch (rejRes) {
        logger.warn(`Rate limit exceeded for IP: ${req.ip}`)
        res.status(429).json({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: Math.round(rejRes.msBeforeNext / 1000)
        })
      }
    })

    // Request logging
    this.app.use(requestLogger)

    logger.info('✅ Middleware setup completed')
  }

  setupRoutes() {
    logger.info('🛣️ Setting up routes...')

    // Debug middleware to log all requests
    this.app.use((req, res, next) => {
      logger.info(`🌐 ${req.method} ${req.path}`, {
        headers: req.headers,
        body: req.body,
        query: req.query,
        contentType: req.get('content-type')
      })
      next()
    })

    // Health check routes
    this.app.use('/health', healthRoutes)

    // MCP protocol routes
    this.app.use('/mcp', mcpRoutes)

    // API information endpoint
    this.app.get('/', (req, res) => {
      res.json({
        name: 'MCP Switch Manager Addon',
        version: '1.0.0',
        description: 'Comprehensive network switch management with VLAN automation and real-time diagnostics',
        capabilities: [
          'VLAN Management (32 tools)',
          'Real-time Diagnostics',
          'Configuration Management',
          'Cross-switch Automation',
          'Multi-vendor Support (Vimins + Sodola)'
        ],
        endpoints: {
          health: '/health',
          mcp: '/mcp',
          docs: '/docs'
        },
        supported_switches: {
          vimins: ['VM-S100-0800MS'],
          sodola: ['SL-SWTGW218AS']
        }
      })
    })

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.originalUrl} not found`,
        availableEndpoints: ['/health', '/mcp', '/']
      })
    })

    logger.info('✅ Routes setup completed')
  }

  setupErrorHandling() {
    logger.info('🚨 Setting up error handling...')

    // Global error handler
    this.app.use(errorHandler)

    // Unhandled promise rejection handler
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason)
      // Don't exit the process, just log the error
    })

    // Uncaught exception handler
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error)
      // Graceful shutdown
      this.shutdown()
    })

    // Graceful shutdown handlers
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully')
      this.shutdown()
    })

    process.on('SIGINT', () => {
      logger.info('SIGINT received, shutting down gracefully')
      this.shutdown()
    })

    logger.info('✅ Error handling setup completed')
  }

  async start() {
    try {
      await this.initialize()

      this.server = this.app.listen(this.port, () => {
        logger.info(`🌟 MCP Switch Manager Addon Server started successfully`)
        logger.info(`📍 Server running on port ${this.port}`)
        logger.info(`🔗 Health check: http://localhost:${this.port}/health`)
        logger.info(`🔗 MCP endpoint: http://localhost:${this.port}/mcp`)
        logger.info(`🎯 Ready to manage network switches!`)
      })

      // Handle server errors
      this.server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
          logger.error(`❌ Port ${this.port} is already in use`)
        } else {
          logger.error('❌ Server error:', error)
        }
        process.exit(1)
      })

    } catch (error) {
      logger.error('❌ Failed to start server:', error)
      process.exit(1)
    }
  }

  async shutdown() {
    logger.info('🛑 Shutting down server...')

    try {
      // Close server
      if (this.server) {
        await new Promise((resolve) => {
          this.server.close(resolve)
        })
        logger.info('✅ Server closed')
      }

      // Cleanup services
      if (this.services) {
        for (const [name, service] of Object.entries(this.services)) {
          if (service && typeof service.cleanup === 'function') {
            await service.cleanup()
            logger.info(`✅ ${name} service cleaned up`)
          }
        }
      }

      logger.info('✅ Graceful shutdown completed')
      process.exit(0)
    } catch (error) {
      logger.error('❌ Error during shutdown:', error)
      process.exit(1)
    }
  }
}

// Start the server if this file is run directly
if (require.main === module) {
  const server = new MCPSwitchManagerServer()
  server.start().catch((error) => {
    logger.error('❌ Failed to start MCP Switch Manager Addon:', error)
    process.exit(1)
  })
}

module.exports = MCPSwitchManagerServer
