/**
 * Switch Manager Service
 * Coordinates management of all switches (Vimins and Sodola)
 */

const ViminsManager = require('./switch_managers/ViminsManager')
const SodolaManager = require('./switch_managers/SodolaManager')
const config = require('../utils/config')
const logger = require('../utils/logger')

class SwitchManagerService {
  constructor() {
    this.switches = new Map()
    this.initialized = false
    this.healthCheckInterval = null
  }

  async initialize() {
    try {
      logger.info('🔧 Initializing Switch Manager Service')
      
      // Initialize all configured switches
      const allSwitches = config.getAllSwitches()
      
      for (const [switchId, switchConfig] of Object.entries(allSwitches)) {
        try {
          let manager
          
          if (switchConfig.type === 'vimins') {
            manager = new ViminsManager(switchConfig)
          } else if (switchConfig.type === 'sodola') {
            manager = new SodolaManager(switchConfig)
          } else {
            logger.warn(`Unknown switch type: ${switchConfig.type} for ${switchId}`)
            continue
          }
          
          // Test authentication
          await manager.authenticate()
          
          this.switches.set(switchId, {
            manager,
            config: switchConfig,
            lastHealthCheck: null,
            status: 'online'
          })
          
          logger.info(`✅ Initialized ${switchConfig.type} switch: ${switchConfig.name} (${switchConfig.ip})`)
          
        } catch (error) {
          logger.error(`❌ Failed to initialize switch ${switchId}:`, error.message)
          
          // Still add to switches map but mark as offline
          this.switches.set(switchId, {
            manager: null,
            config: switchConfig,
            lastHealthCheck: null,
            status: 'offline',
            error: error.message
          })
        }
      }
      
      // Start health check monitoring
      this.startHealthCheckMonitoring()
      
      this.initialized = true
      logger.info(`🎯 Switch Manager Service initialized with ${this.switches.size} switches`)
      
    } catch (error) {
      logger.error('❌ Failed to initialize Switch Manager Service:', error)
      throw error
    }
  }

  startHealthCheckMonitoring() {
    const interval = config.monitoring.healthCheckInterval
    
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.performHealthChecks()
      } catch (error) {
        logger.error('Health check monitoring error:', error)
      }
    }, interval)
    
    logger.info(`🏥 Health check monitoring started (interval: ${interval}ms)`)
  }

  async performHealthChecks() {
    logger.debug('🏥 Performing health checks on all switches')
    
    const healthPromises = Array.from(this.switches.entries()).map(async ([switchId, switchInfo]) => {
      try {
        if (switchInfo.manager) {
          const health = await switchInfo.manager.healthCheck()
          
          switchInfo.lastHealthCheck = new Date()
          switchInfo.status = health.authenticated ? 'online' : 'offline'
          
          if (!health.authenticated) {
            logger.warn(`Switch ${switchId} health check failed - attempting reconnection`)
            try {
              await switchInfo.manager.authenticate()
              switchInfo.status = 'online'
              logger.info(`✅ Reconnected to switch ${switchId}`)
            } catch (reconnectError) {
              logger.error(`Failed to reconnect to switch ${switchId}:`, reconnectError.message)
            }
          }
          
          return { switchId, health }
        } else {
          return { switchId, health: { error: 'Manager not initialized' } }
        }
      } catch (error) {
        logger.error(`Health check failed for switch ${switchId}:`, error.message)
        switchInfo.status = 'offline'
        return { switchId, health: { error: error.message } }
      }
    })
    
    const results = await Promise.allSettled(healthPromises)
    const onlineCount = results.filter(r => 
      r.status === 'fulfilled' && 
      r.value.health.authenticated
    ).length
    
    logger.debug(`Health check completed: ${onlineCount}/${this.switches.size} switches online`)
  }

  // Switch Management Methods
  getSwitch(switchId) {
    const switchInfo = this.switches.get(switchId)
    if (!switchInfo) {
      throw new Error(`Switch not found: ${switchId}`)
    }
    return switchInfo
  }

  getSwitchManager(switchId) {
    const switchInfo = this.getSwitch(switchId)
    if (!switchInfo.manager) {
      throw new Error(`Switch manager not available for: ${switchId}`)
    }
    return switchInfo.manager
  }

  getAllSwitches() {
    return Array.from(this.switches.entries()).map(([id, info]) => ({
      id,
      name: info.config.name,
      ip: info.config.ip,
      type: info.config.type,
      model: info.config.model,
      status: info.status,
      lastHealthCheck: info.lastHealthCheck,
      error: info.error
    }))
  }

  getSwitchesByType(type) {
    return this.getAllSwitches().filter(s => s.type === type)
  }

  getOnlineSwitches() {
    return this.getAllSwitches().filter(s => s.status === 'online')
  }

  // Unified API Methods
  async getSystemInfo(switchId) {
    const manager = this.getSwitchManager(switchId)
    return await manager.getSystemInfo()
  }

  async getPortStatus(switchId) {
    const manager = this.getSwitchManager(switchId)
    return await manager.getPortStatus()
  }

  async configurePort(switchId, portId, config) {
    const manager = this.getSwitchManager(switchId)
    return await manager.configurePort(portId, config)
  }

  async getVLANConfig(switchId) {
    const manager = this.getSwitchManager(switchId)
    return await manager.getVLANConfig()
  }

  async createVLAN(switchId, vlanId, vlanName, description = '') {
    const manager = this.getSwitchManager(switchId)
    return await manager.createVLAN(vlanId, vlanName, description)
  }

  async configureVLANPort(switchId, portId, vlanConfig) {
    const manager = this.getSwitchManager(switchId)
    return await manager.configureVLANPort(portId, vlanConfig)
  }

  async backupConfiguration(switchId) {
    const manager = this.getSwitchManager(switchId)
    return await manager.backupConfiguration()
  }

  async restoreConfiguration(switchId, configData) {
    const manager = this.getSwitchManager(switchId)
    return await manager.restoreConfiguration(configData)
  }

  // Bulk Operations
  async bulkOperation(operation, switchIds, ...args) {
    const results = {}
    
    const promises = switchIds.map(async (switchId) => {
      try {
        const manager = this.getSwitchManager(switchId)
        const result = await manager[operation](...args)
        results[switchId] = { success: true, data: result }
      } catch (error) {
        logger.error(`Bulk operation ${operation} failed for ${switchId}:`, error.message)
        results[switchId] = { success: false, error: error.message }
      }
    })
    
    await Promise.allSettled(promises)
    return results
  }

  async bulkSystemInfo(switchIds = null) {
    const targetSwitches = switchIds || this.getOnlineSwitches().map(s => s.id)
    return await this.bulkOperation('getSystemInfo', targetSwitches)
  }

  async bulkPortStatus(switchIds = null) {
    const targetSwitches = switchIds || this.getOnlineSwitches().map(s => s.id)
    return await this.bulkOperation('getPortStatus', targetSwitches)
  }

  async bulkVLANConfig(switchIds = null) {
    const targetSwitches = switchIds || this.getOnlineSwitches().map(s => s.id)
    return await this.bulkOperation('getVLANConfig', targetSwitches)
  }

  async bulkBackup(switchIds = null) {
    const targetSwitches = switchIds || this.getOnlineSwitches().map(s => s.id)
    return await this.bulkOperation('backupConfiguration', targetSwitches)
  }

  // Network Topology Methods
  getNetworkTopology() {
    const topology = config.getTopology()
    const switches = this.getAllSwitches()
    
    return {
      switches,
      interCoreLinks: topology.interCoreLinks,
      uplinkConnections: topology.uplinkConnections,
      timestamp: new Date().toISOString()
    }
  }

  getInterCoreSwitches() {
    return this.getSwitchesByType('vimins')
  }

  getAccessSwitches() {
    return this.getSwitchesByType('sodola')
  }

  // Service Status
  getServiceStatus() {
    const switches = this.getAllSwitches()
    const onlineCount = switches.filter(s => s.status === 'online').length
    
    return {
      initialized: this.initialized,
      totalSwitches: switches.length,
      onlineSwitches: onlineCount,
      offlineSwitches: switches.length - onlineCount,
      healthCheckRunning: !!this.healthCheckInterval,
      lastHealthCheck: Math.max(...switches.map(s => 
        s.lastHealthCheck ? s.lastHealthCheck.getTime() : 0
      )),
      switches
    }
  }

  // Cleanup
  async cleanup() {
    logger.info('🧹 Cleaning up Switch Manager Service')
    
    // Stop health check monitoring
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = null
    }
    
    // Cleanup all switch managers
    for (const [switchId, switchInfo] of this.switches.entries()) {
      if (switchInfo.manager && typeof switchInfo.manager.cleanup === 'function') {
        try {
          await switchInfo.manager.cleanup()
          logger.debug(`Cleaned up switch manager: ${switchId}`)
        } catch (error) {
          logger.error(`Error cleaning up switch manager ${switchId}:`, error.message)
        }
      }
    }
    
    this.switches.clear()
    this.initialized = false
    
    logger.info('✅ Switch Manager Service cleanup completed')
  }
}

module.exports = SwitchManagerService
