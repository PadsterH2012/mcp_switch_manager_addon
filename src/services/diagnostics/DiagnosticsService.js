/**
 * Diagnostics Service
 * Centralized diagnostics and monitoring capabilities
 */

const logger = require('../../utils/logger')
const config = require('../../utils/config')

class DiagnosticsService {
  constructor(switchManagerService) {
    this.switchManager = switchManagerService
    this.initialized = false
    this.diagnosticHistory = new Map()
    this.monitoringInterval = null
  }

  async initialize() {
    try {
      logger.info('🔍 Initializing Diagnostics Service')
      
      // Start periodic diagnostics if enabled
      if (config.monitoring.diagnosticInterval > 0) {
        this.startPeriodicDiagnostics()
      }
      
      this.initialized = true
      logger.info('✅ Diagnostics Service initialized')
      
    } catch (error) {
      logger.error('❌ Failed to initialize Diagnostics Service:', error)
      throw error
    }
  }

  startPeriodicDiagnostics() {
    const interval = config.monitoring.diagnosticInterval
    
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.performScheduledDiagnostics()
      } catch (error) {
        logger.error('Scheduled diagnostics error:', error)
      }
    }, interval)
    
    logger.info(`🔍 Periodic diagnostics started (interval: ${interval}ms)`)
  }

  async performScheduledDiagnostics() {
    logger.debug('🔍 Performing scheduled diagnostics')
    
    try {
      // Get all online switches
      const onlineSwitches = this.switchManager.getOnlineSwitches()
      
      // Perform basic health checks
      for (const switchInfo of onlineSwitches) {
        try {
          const manager = this.switchManager.getSwitchManager(switchInfo.id)
          const health = await manager.healthCheck()
          
          // Store diagnostic result
          this.storeDiagnosticResult(switchInfo.id, 'health_check', health)
          
          // Check for alerts
          this.checkForAlerts(switchInfo.id, health)
          
        } catch (error) {
          logger.warn(`Scheduled diagnostic failed for ${switchInfo.id}:`, error.message)
        }
      }
      
    } catch (error) {
      logger.error('Scheduled diagnostics failed:', error)
    }
  }

  storeDiagnosticResult(switchId, type, result) {
    if (!this.diagnosticHistory.has(switchId)) {
      this.diagnosticHistory.set(switchId, [])
    }
    
    const history = this.diagnosticHistory.get(switchId)
    history.push({
      timestamp: new Date().toISOString(),
      type,
      result
    })
    
    // Keep only last 100 results per switch
    if (history.length > 100) {
      history.splice(0, history.length - 100)
    }
  }

  checkForAlerts(switchId, healthData) {
    const alerts = []
    
    // Check authentication status
    if (!healthData.authenticated) {
      alerts.push({
        severity: 'critical',
        type: 'authentication_failure',
        message: `Switch ${switchId} authentication failed`
      })
    }
    
    // Check system metrics if available
    if (healthData.systemInfo) {
      // CPU usage alert
      const cpuUsage = this.extractCPUUsage(healthData.systemInfo)
      if (cpuUsage > config.monitoring.alertThresholds.cpuUsage) {
        alerts.push({
          severity: 'warning',
          type: 'high_cpu_usage',
          message: `Switch ${switchId} CPU usage: ${cpuUsage}%`
        })
      }
      
      // Memory usage alert
      const memoryUsage = this.extractMemoryUsage(healthData.systemInfo)
      if (memoryUsage > config.monitoring.alertThresholds.memoryUsage) {
        alerts.push({
          severity: 'warning',
          type: 'high_memory_usage',
          message: `Switch ${switchId} memory usage: ${memoryUsage}%`
        })
      }
    }
    
    // Log alerts
    alerts.forEach(alert => {
      if (alert.severity === 'critical') {
        logger.error(`ALERT: ${alert.message}`, alert)
      } else {
        logger.warn(`ALERT: ${alert.message}`, alert)
      }
    })
    
    return alerts
  }

  extractCPUUsage(systemInfo) {
    // Extract CPU usage from system info
    // Implementation depends on switch type and data format
    return 0 // Placeholder
  }

  extractMemoryUsage(systemInfo) {
    // Extract memory usage from system info
    // Implementation depends on switch type and data format
    return 0 // Placeholder
  }

  async performComprehensiveDiagnostics(switchId) {
    try {
      const manager = this.switchManager.getSwitchManager(switchId)
      const switchInfo = this.switchManager.getSwitch(switchId)
      
      const diagnostics = {
        switch_id: switchId,
        switch_info: {
          name: switchInfo.config.name,
          ip: switchInfo.config.ip,
          type: switchInfo.config.type,
          model: switchInfo.config.model
        },
        timestamp: new Date().toISOString(),
        results: {}
      }
      
      // Health check
      try {
        diagnostics.results.health = await manager.healthCheck()
      } catch (error) {
        diagnostics.results.health = { error: error.message }
      }
      
      // System information
      try {
        diagnostics.results.system_info = await manager.getSystemInfo()
      } catch (error) {
        diagnostics.results.system_info = { error: error.message }
      }
      
      // Port status
      try {
        diagnostics.results.port_status = await manager.getPortStatus()
      } catch (error) {
        diagnostics.results.port_status = { error: error.message }
      }
      
      // VLAN configuration
      try {
        diagnostics.results.vlan_config = await manager.getVLANConfig()
      } catch (error) {
        diagnostics.results.vlan_config = { error: error.message }
      }
      
      // Additional diagnostics for Vimins switches
      if (switchInfo.config.type === 'vimins') {
        try {
          diagnostics.results.lag_config = await manager.getLAGConfig()
        } catch (error) {
          diagnostics.results.lag_config = { error: error.message }
        }
        
        try {
          diagnostics.results.mac_table = await manager.getMACTable()
        } catch (error) {
          diagnostics.results.mac_table = { error: error.message }
        }
      }
      
      // Store diagnostic result
      this.storeDiagnosticResult(switchId, 'comprehensive', diagnostics)
      
      return diagnostics
      
    } catch (error) {
      logger.error(`Comprehensive diagnostics failed for ${switchId}:`, error.message)
      throw error
    }
  }

  async performNetworkTopologyDiagnostics() {
    try {
      const topology = this.switchManager.getNetworkTopology()
      const diagnostics = {
        timestamp: new Date().toISOString(),
        topology,
        connectivity_tests: {},
        issues: []
      }
      
      // Test inter-core connectivity
      const coreSwitch1 = 'vimins_core1'
      const coreSwitch2 = 'vimins_core2'
      
      try {
        const core1Health = await this.switchManager.getSwitchManager(coreSwitch1).healthCheck()
        const core2Health = await this.switchManager.getSwitchManager(coreSwitch2).healthCheck()
        
        diagnostics.connectivity_tests.inter_core = {
          core1_online: core1Health.authenticated,
          core2_online: core2Health.authenticated,
          lag_status: 'unknown' // Would need to check LAG status
        }
        
        if (!core1Health.authenticated || !core2Health.authenticated) {
          diagnostics.issues.push({
            severity: 'critical',
            type: 'core_switch_offline',
            description: 'One or more core switches are offline'
          })
        }
      } catch (error) {
        diagnostics.connectivity_tests.inter_core = { error: error.message }
      }
      
      // Test access switch connectivity
      const accessSwitches = this.switchManager.getSwitchesByType('sodola')
      
      for (const accessSwitch of accessSwitches) {
        try {
          const health = await this.switchManager.getSwitchManager(accessSwitch.id).healthCheck()
          diagnostics.connectivity_tests[accessSwitch.id] = {
            online: health.authenticated,
            uplink_status: 'unknown' // Would need to check uplink port status
          }
          
          if (!health.authenticated) {
            diagnostics.issues.push({
              severity: 'warning',
              type: 'access_switch_offline',
              description: `Access switch ${accessSwitch.name} is offline`
            })
          }
        } catch (error) {
          diagnostics.connectivity_tests[accessSwitch.id] = { error: error.message }
        }
      }
      
      return diagnostics
      
    } catch (error) {
      logger.error('Network topology diagnostics failed:', error.message)
      throw error
    }
  }

  getDiagnosticHistory(switchId, limit = 10) {
    const history = this.diagnosticHistory.get(switchId) || []
    return history.slice(-limit)
  }

  getAllDiagnosticHistory(limit = 10) {
    const allHistory = {}
    
    for (const [switchId, history] of this.diagnosticHistory.entries()) {
      allHistory[switchId] = history.slice(-limit)
    }
    
    return allHistory
  }

  getServiceStatus() {
    return {
      initialized: this.initialized,
      monitoring_active: !!this.monitoringInterval,
      diagnostic_history_size: this.diagnosticHistory.size,
      total_diagnostics: Array.from(this.diagnosticHistory.values())
        .reduce((total, history) => total + history.length, 0)
    }
  }

  async cleanup() {
    logger.info('🧹 Cleaning up Diagnostics Service')
    
    // Stop monitoring interval
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
    }
    
    // Clear diagnostic history
    this.diagnosticHistory.clear()
    
    this.initialized = false
    logger.info('✅ Diagnostics Service cleanup completed')
  }
}

module.exports = DiagnosticsService
