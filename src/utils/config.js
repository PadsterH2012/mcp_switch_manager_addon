/**
 * Configuration management for MCP Switch Manager Addon
 */

const path = require('path')
const logger = require('./logger')

class Config {
  constructor() {
    this.loadConfiguration()
  }

  loadConfiguration() {
    // Server configuration
    this.port = parseInt(process.env.MCP_PORT || '8087', 10)
    this.host = process.env.MCP_HOST || '0.0.0.0'
    this.nodeEnv = process.env.NODE_ENV || 'development'
    
    // CORS configuration
    this.corsOrigins = process.env.CORS_ORIGINS 
      ? process.env.CORS_ORIGINS.split(',')
      : ['http://localhost:3000', 'http://localhost:8080']
    
    // Logging configuration
    this.logLevel = process.env.LOG_LEVEL || 'info'
    this.logDir = process.env.LOG_DIR || path.join(process.cwd(), 'logs')
    
    // Switch configuration
    this.switches = {
      vimins: {
        core1: {
          ip: process.env.VIMINS_CORE1_IP || '10.202.28.9',
          name: 'Coreswitch_1_Office',
          model: 'VM-S100-0800MS',
          type: 'vimins',
          username: process.env.VIMINS_USERNAME || 'admin',
          password: process.env.VIMINS_PASSWORD || 'admin',
          timeout: parseInt(process.env.VIMINS_TIMEOUT || '15000', 10)
        },
        core2: {
          ip: process.env.VIMINS_CORE2_IP || '10.202.28.10',
          name: 'Coreswitch_1_Bedroom',
          model: 'VM-S100-0800MS',
          type: 'vimins',
          username: process.env.VIMINS_USERNAME || 'admin',
          password: process.env.VIMINS_PASSWORD || 'admin',
          timeout: parseInt(process.env.VIMINS_TIMEOUT || '15000', 10)
        }
      },
      sodola: {
        office: {
          ip: process.env.SODOLA_OFFICE_IP || '10.202.28.13',
          name: 'Office_Switch',
          model: 'SL-SWTGW218AS',
          type: 'sodola',
          mac: '1C:2A:A3:1E:8D:F8',
          username: process.env.SODOLA_USERNAME || 'admin',
          password: process.env.SODOLA_PASSWORD || 'admin',
          timeout: parseInt(process.env.SODOLA_TIMEOUT || '15000', 10)
        },
        proxmox: {
          ip: process.env.SODOLA_PROXMOX_IP || '10.202.28.12',
          name: 'Proxmox_Host_Switch',
          model: 'SL-SWTGW218AS',
          type: 'sodola',
          mac: '1C:2A:A3:1A:70:77',
          username: process.env.SODOLA_USERNAME || 'admin',
          password: process.env.SODOLA_PASSWORD || 'admin',
          timeout: parseInt(process.env.SODOLA_TIMEOUT || '15000', 10)
        },
        backup: {
          ip: process.env.SODOLA_BACKUP_IP || '10.202.28.14',
          name: 'Backup_Switch',
          model: 'SL-SWTGW218AS',
          type: 'sodola',
          mac: '1C:2A:A3:1E:8E:40',
          username: process.env.SODOLA_USERNAME || 'admin',
          password: process.env.SODOLA_PASSWORD || 'admin',
          timeout: parseInt(process.env.SODOLA_TIMEOUT || '15000', 10)
        }
      }
    }
    
    // Network topology configuration
    this.topology = {
      interCoreLinks: {
        lag1: {
          core1Ports: ['TE3', 'TE4'],
          core2Ports: ['TE3', 'TE4'],
          description: 'Inter-core LAG1 connectivity'
        }
      },
      uplinkConnections: {
        office: {
          switch: 'sodola.office',
          primaryCore: 'vimins.core1',
          primaryPort: 'TE6',
          secondaryCore: 'vimins.core2',
          secondaryPort: 'LAG1'
        },
        proxmox: {
          switch: 'sodola.proxmox',
          primaryCore: 'vimins.core2',
          primaryPort: 'TE6',
          secondaryCore: 'vimins.core1',
          secondaryPort: 'LAG1'
        },
        backup: {
          switch: 'sodola.backup',
          primaryCore: 'vimins.core2',
          primaryPort: 'TE5',
          secondaryCore: 'vimins.core1',
          secondaryPort: 'LAG1'
        }
      }
    }
    
    // VLAN configuration
    this.vlans = {
      standard: {
        100: { name: 'BACKUP', description: 'Backup Infrastructure' },
        200: { name: 'WAN', description: 'Internet Gateway' },
        300: { name: 'GUEST', description: 'Guest Network' },
        400: { name: 'IOT', description: 'IoT Devices' },
        500: { name: 'MGMT', description: 'Management Network' },
        600: { name: 'USERPC', description: 'User Workstations' },
        700: { name: 'HWSND', description: 'Hardware Sound' }
      },
      reserved: [1, 1002, 1003, 1004, 1005], // Reserved VLAN IDs
      managementVlan: 500
    }
    
    // Backup and configuration management
    this.backup = {
      enabled: process.env.BACKUP_ENABLED !== 'false',
      schedule: process.env.BACKUP_SCHEDULE || '0 2 * * *', // Daily at 2 AM
      retention: parseInt(process.env.BACKUP_RETENTION || '30', 10), // 30 days
      directory: process.env.BACKUP_DIR || path.join(process.cwd(), 'data', 'backups'),
      gitEnabled: process.env.GIT_BACKUP_ENABLED === 'true',
      gitRepository: process.env.GIT_BACKUP_REPO || ''
    }
    
    // Monitoring and diagnostics
    this.monitoring = {
      healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '300000', 10), // 5 minutes
      diagnosticInterval: parseInt(process.env.DIAGNOSTIC_INTERVAL || '900000', 10), // 15 minutes
      alertThresholds: {
        cpuUsage: parseInt(process.env.CPU_ALERT_THRESHOLD || '80', 10),
        memoryUsage: parseInt(process.env.MEMORY_ALERT_THRESHOLD || '85', 10),
        portErrorRate: parseFloat(process.env.PORT_ERROR_THRESHOLD || '0.01')
      }
    }
    
    // Rate limiting
    this.rateLimiting = {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '60000', 10), // 1 minute
      maxRequests: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
      skipSuccessfulRequests: process.env.RATE_LIMIT_SKIP_SUCCESS === 'true'
    }
    
    // Security configuration
    this.security = {
      enableHttps: process.env.ENABLE_HTTPS === 'true',
      sslCertPath: process.env.SSL_CERT_PATH || '',
      sslKeyPath: process.env.SSL_KEY_PATH || '',
      sessionSecret: process.env.SESSION_SECRET || 'mcp-switch-manager-secret',
      jwtSecret: process.env.JWT_SECRET || 'mcp-jwt-secret',
      encryptionKey: process.env.ENCRYPTION_KEY || 'mcp-encryption-key'
    }
    
    // Feature flags
    this.features = {
      vlanManagement: process.env.FEATURE_VLAN_MANAGEMENT !== 'false',
      realTimeDiagnostics: process.env.FEATURE_REAL_TIME_DIAGNOSTICS !== 'false',
      configurationManagement: process.env.FEATURE_CONFIG_MANAGEMENT !== 'false',
      crossSwitchAutomation: process.env.FEATURE_CROSS_SWITCH_AUTOMATION !== 'false',
      performanceMonitoring: process.env.FEATURE_PERFORMANCE_MONITORING !== 'false',
      advancedReporting: process.env.FEATURE_ADVANCED_REPORTING !== 'false'
    }
    
    // Validate configuration
    this.validateConfiguration()
  }

  validateConfiguration() {
    const errors = []
    
    // Validate port
    if (this.port < 1 || this.port > 65535) {
      errors.push('Invalid port number. Must be between 1 and 65535.')
    }
    
    // Validate switch IPs
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
    
    Object.values(this.switches.vimins).forEach(switchConfig => {
      if (!ipRegex.test(switchConfig.ip)) {
        errors.push(`Invalid Vimins switch IP: ${switchConfig.ip}`)
      }
    })
    
    Object.values(this.switches.sodola).forEach(switchConfig => {
      if (!ipRegex.test(switchConfig.ip)) {
        errors.push(`Invalid Sodola switch IP: ${switchConfig.ip}`)
      }
    })
    
    // Validate VLAN IDs
    Object.keys(this.vlans.standard).forEach(vlanId => {
      const id = parseInt(vlanId, 10)
      if (id < 1 || id > 4094) {
        errors.push(`Invalid VLAN ID: ${id}. Must be between 1 and 4094.`)
      }
    })
    
    if (errors.length > 0) {
      logger.error('Configuration validation failed:', errors)
      throw new Error(`Configuration validation failed: ${errors.join(', ')}`)
    }
    
    logger.info('✅ Configuration validation passed')
  }

  // Get all switch configurations
  getAllSwitches() {
    const switches = {}
    
    Object.entries(this.switches.vimins).forEach(([key, config]) => {
      switches[`vimins_${key}`] = config
    })
    
    Object.entries(this.switches.sodola).forEach(([key, config]) => {
      switches[`sodola_${key}`] = config
    })
    
    return switches
  }

  // Get switch configuration by ID
  getSwitch(switchId) {
    const allSwitches = this.getAllSwitches()
    return allSwitches[switchId] || null
  }

  // Get switches by type
  getSwitchesByType(type) {
    const allSwitches = this.getAllSwitches()
    return Object.entries(allSwitches)
      .filter(([_, config]) => config.type === type)
      .reduce((acc, [id, config]) => {
        acc[id] = config
        return acc
      }, {})
  }

  // Get VLAN configuration
  getVLANConfig(vlanId) {
    return this.vlans.standard[vlanId] || null
  }

  // Check if VLAN ID is reserved
  isVLANReserved(vlanId) {
    return this.vlans.reserved.includes(parseInt(vlanId, 10))
  }

  // Get topology information
  getTopology() {
    return this.topology
  }
}

// Create and export singleton instance
const config = new Config()

module.exports = config
