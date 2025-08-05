/**
 * Health check routes
 */

const express = require('express')
const logger = require('../utils/logger')
const config = require('../utils/config')

const router = express.Router()

// Basic health check
router.get('/', (req, res) => {
  const services = global.mcpServices
  
  if (!services) {
    return res.status(503).json({
      status: 'unhealthy',
      message: 'Services not initialized',
      timestamp: new Date().toISOString()
    })
  }
  
  try {
    const switchManagerStatus = services.switchManager?.getServiceStatus()
    const vlanManagerStatus = services.vlanManager?.getServiceStatus()
    
    const isHealthy = switchManagerStatus?.initialized && vlanManagerStatus?.initialized
    
    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      services: {
        switchManager: switchManagerStatus,
        vlanManager: vlanManagerStatus
      },
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    logger.error('Health check error:', error)
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    })
  }
})

// Detailed health check
router.get('/detailed', async (req, res) => {
  const services = global.mcpServices
  
  if (!services) {
    return res.status(503).json({
      status: 'unhealthy',
      message: 'Services not initialized'
    })
  }
  
  try {
    const switchManagerStatus = services.switchManager?.getServiceStatus()
    const vlanManagerStatus = services.vlanManager?.getServiceStatus()
    
    // Get switch health if available
    let switchHealth = null
    if (services.switchManager) {
      try {
        const switches = services.switchManager.getAllSwitches()
        switchHealth = {
          total: switches.length,
          online: switches.filter(s => s.status === 'online').length,
          offline: switches.filter(s => s.status === 'offline').length,
          switches: switches.map(s => ({
            id: s.id,
            name: s.name,
            status: s.status,
            lastHealthCheck: s.lastHealthCheck
          }))
        }
      } catch (error) {
        switchHealth = { error: error.message }
      }
    }
    
    const isHealthy = switchManagerStatus?.initialized && vlanManagerStatus?.initialized
    
    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      services: {
        switchManager: switchManagerStatus,
        vlanManager: vlanManagerStatus
      },
      switches: switchHealth,
      configuration: {
        totalSwitches: Object.keys(config.getAllSwitches()).length,
        viminsCount: Object.keys(config.getSwitchesByType('vimins')).length,
        sodolaCount: Object.keys(config.getSwitchesByType('sodola')).length
      },
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    logger.error('Detailed health check error:', error)
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    })
  }
})

// Readiness probe
router.get('/ready', (req, res) => {
  const services = global.mcpServices
  
  const isReady = services && 
                  services.switchManager?.initialized && 
                  services.vlanManager?.initialized
  
  res.status(isReady ? 200 : 503).json({
    ready: isReady,
    timestamp: new Date().toISOString()
  })
})

// Liveness probe
router.get('/live', (req, res) => {
  res.json({
    alive: true,
    timestamp: new Date().toISOString()
  })
})

module.exports = router
