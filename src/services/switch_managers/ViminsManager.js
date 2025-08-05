/**
 * Vimins Switch Manager
 * Handles communication with Vimins VM-S100-0800MS switches via CGI API
 */

const axios = require('axios')
const logger = require('../../utils/logger')

class ViminsManager {
  constructor(switchConfig) {
    this.config = switchConfig
    this.session = null
    this.authenticated = false
    this.lastAuthTime = null
    this.authTimeout = 30 * 60 * 1000 // 30 minutes
    
    // Configure axios instance
    this.client = axios.create({
      baseURL: `http://${this.config.ip}`,
      timeout: this.config.timeout || 15000,
      headers: {
        'User-Agent': 'MCP-Switch-Manager/1.0',
        'Accept': 'application/json, text/plain, */*'
      }
    })
    
    // Add request/response interceptors
    this.setupInterceptors()
  }

  setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        logger.debug(`Vimins API Request: ${config.method?.toUpperCase()} ${config.url}`)
        return config
      },
      (error) => {
        logger.error('Vimins API Request Error:', error)
        return Promise.reject(error)
      }
    )

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        logger.debug(`Vimins API Response: ${response.status} ${response.config.url}`)
        return response
      },
      (error) => {
        logger.error('Vimins API Response Error:', {
          url: error.config?.url,
          status: error.response?.status,
          message: error.message
        })
        return Promise.reject(error)
      }
    )
  }

  async authenticate() {
    try {
      logger.info(`🔐 Authenticating to Vimins switch: ${this.config.name} (${this.config.ip})`)
      
      const timestamp = Date.now()
      
      // Step 1: Get login info
      const loginInfoResponse = await this.client.get('/cgi/get.cgi', {
        params: {
          cmd: 'home_login',
          dummy: timestamp
        }
      })
      
      if (loginInfoResponse.status !== 200) {
        throw new Error(`Failed to get login info: ${loginInfoResponse.status}`)
      }
      
      // Step 2: Submit login credentials
      const loginResponse = await this.client.post('/cgi/set.cgi', 
        new URLSearchParams({
          username: this.config.username,
          password: this.config.password
        }), {
          params: {
            cmd: 'home_loginAuth',
            dummy: timestamp
          },
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      )
      
      if (loginResponse.status !== 200) {
        throw new Error(`Login submission failed: ${loginResponse.status}`)
      }
      
      // Step 3: Verify authentication status
      let authVerified = false
      for (let attempt = 0; attempt < 5; attempt++) {
        const statusResponse = await this.client.get('/cgi/get.cgi', {
          params: {
            cmd: 'home_loginStatus',
            dummy: Date.now()
          }
        })
        
        if (statusResponse.status === 200 && statusResponse.data) {
          const statusData = statusResponse.data
          if (statusData.data && statusData.data.status === 'ok') {
            authVerified = true
            break
          }
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
      
      if (!authVerified) {
        throw new Error('Authentication verification failed')
      }
      
      this.authenticated = true
      this.lastAuthTime = Date.now()
      
      logger.info(`✅ Successfully authenticated to ${this.config.name}`)
      return true
      
    } catch (error) {
      logger.error(`❌ Authentication failed for ${this.config.name}:`, error.message)
      this.authenticated = false
      throw error
    }
  }

  async ensureAuthenticated() {
    const now = Date.now()
    
    // Check if we need to re-authenticate
    if (!this.authenticated || 
        !this.lastAuthTime || 
        (now - this.lastAuthTime) > this.authTimeout) {
      await this.authenticate()
    }
    
    return this.authenticated
  }

  async apiCall(command, params = {}, method = 'GET') {
    try {
      await this.ensureAuthenticated()
      
      const timestamp = Date.now()
      const requestParams = {
        cmd: command,
        dummy: timestamp,
        ...params
      }
      
      let response
      if (method === 'GET') {
        response = await this.client.get('/cgi/get.cgi', {
          params: requestParams
        })
      } else if (method === 'POST') {
        response = await this.client.post('/cgi/set.cgi', 
          new URLSearchParams(params), {
            params: {
              cmd: command,
              dummy: timestamp
            },
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            }
          }
        )
      }
      
      if (response.status === 200) {
        return response.data
      } else {
        throw new Error(`API call failed: ${response.status}`)
      }
      
    } catch (error) {
      logger.error(`Vimins API call failed for ${command}:`, error.message)
      
      // If authentication error, reset auth state
      if (error.response?.status === 401 || error.response?.status === 403) {
        this.authenticated = false
        this.lastAuthTime = null
      }
      
      throw error
    }
  }

  // System Information
  async getSystemInfo() {
    try {
      const commands = ['sys_sysinfo', 'home_main', 'panel_info', 'sys_cpumem']
      const systemInfo = {}
      
      for (const cmd of commands) {
        try {
          const data = await this.apiCall(cmd)
          if (data && data.data) {
            systemInfo[cmd] = data.data
          }
        } catch (error) {
          logger.warn(`Failed to get ${cmd} for ${this.config.name}:`, error.message)
        }
      }
      
      return systemInfo
    } catch (error) {
      logger.error(`Failed to get system info for ${this.config.name}:`, error.message)
      throw error
    }
  }

  // Port Management
  async getPortStatus() {
    try {
      const commands = ['port_port', 'port_cnt', 'port_bwutilz']
      const portInfo = {}
      
      for (const cmd of commands) {
        try {
          const data = await this.apiCall(cmd)
          if (data && data.data) {
            portInfo[cmd] = data.data
          }
        } catch (error) {
          logger.warn(`Failed to get ${cmd} for ${this.config.name}:`, error.message)
        }
      }
      
      return portInfo
    } catch (error) {
      logger.error(`Failed to get port status for ${this.config.name}:`, error.message)
      throw error
    }
  }

  async configurePort(portId, config) {
    try {
      const data = await this.apiCall('port_portEdit', {
        portId,
        ...config
      }, 'POST')
      
      logger.switchOperation('port_configure', this.config.name, { portId, config })
      return data
    } catch (error) {
      logger.error(`Failed to configure port ${portId} on ${this.config.name}:`, error.message)
      throw error
    }
  }

  // VLAN Management
  async getVLANConfig() {
    try {
      const commands = ['vlan_conf', 'vlan_port', 'vlan_membership']
      const vlanInfo = {}
      
      for (const cmd of commands) {
        try {
          const data = await this.apiCall(cmd)
          if (data && data.data) {
            vlanInfo[cmd] = data.data
          }
        } catch (error) {
          logger.warn(`Failed to get ${cmd} for ${this.config.name}:`, error.message)
        }
      }
      
      return vlanInfo
    } catch (error) {
      logger.error(`Failed to get VLAN config for ${this.config.name}:`, error.message)
      throw error
    }
  }

  async createVLAN(vlanId, vlanName, description = '') {
    try {
      const data = await this.apiCall('vlan_create', {
        vlanId: vlanId.toString(),
        vlanName,
        description
      }, 'POST')
      
      logger.vlanOperation('create', vlanId, [this.config.name], { vlanName, description })
      return data
    } catch (error) {
      logger.error(`Failed to create VLAN ${vlanId} on ${this.config.name}:`, error.message)
      throw error
    }
  }

  async configureVLANPort(portId, vlanConfig) {
    try {
      const data = await this.apiCall('vlan_portEdit', {
        portId,
        ...vlanConfig
      }, 'POST')
      
      logger.vlanOperation('port_configure', vlanConfig.vlanId, [this.config.name], { portId, vlanConfig })
      return data
    } catch (error) {
      logger.error(`Failed to configure VLAN on port ${portId} for ${this.config.name}:`, error.message)
      throw error
    }
  }

  async configureVLANMembership(membershipConfig) {
    try {
      const data = await this.apiCall('vlan_membershipEdit', membershipConfig, 'POST')
      
      logger.vlanOperation('membership_configure', membershipConfig.vlanId, [this.config.name], membershipConfig)
      return data
    } catch (error) {
      logger.error(`Failed to configure VLAN membership on ${this.config.name}:`, error.message)
      throw error
    }
  }

  // LAG Management
  async getLAGConfig() {
    try {
      const commands = ['lag_mgmt', 'lag_port', 'lag_lacp']
      const lagInfo = {}
      
      for (const cmd of commands) {
        try {
          const data = await this.apiCall(cmd)
          if (data && data.data) {
            lagInfo[cmd] = data.data
          }
        } catch (error) {
          logger.warn(`Failed to get ${cmd} for ${this.config.name}:`, error.message)
        }
      }
      
      return lagInfo
    } catch (error) {
      logger.error(`Failed to get LAG config for ${this.config.name}:`, error.message)
      throw error
    }
  }

  // MAC Address Table
  async getMACTable() {
    try {
      const commands = ['mac_miscStatus', 'mac_static']
      const macInfo = {}
      
      for (const cmd of commands) {
        try {
          const data = await this.apiCall(cmd)
          if (data && data.data) {
            macInfo[cmd] = data.data
          }
        } catch (error) {
          logger.warn(`Failed to get ${cmd} for ${this.config.name}:`, error.message)
        }
      }
      
      return macInfo
    } catch (error) {
      logger.error(`Failed to get MAC table for ${this.config.name}:`, error.message)
      throw error
    }
  }

  // Configuration Backup/Restore
  async backupConfiguration() {
    try {
      // Get comprehensive configuration data
      const configData = {
        timestamp: new Date().toISOString(),
        switch: this.config.name,
        ip: this.config.ip,
        systemInfo: await this.getSystemInfo(),
        portConfig: await this.getPortStatus(),
        vlanConfig: await this.getVLANConfig(),
        lagConfig: await this.getLAGConfig(),
        macTable: await this.getMACTable()
      }

      logger.configurationChange('backup', this.config.name, { size: JSON.stringify(configData).length })
      return configData
    } catch (error) {
      logger.error(`Failed to backup configuration for ${this.config.name}:`, error.message)
      throw error
    }
  }

  async restoreConfiguration(configData) {
    try {
      const data = await this.apiCall('config_restore', configData, 'POST')
      
      logger.configurationChange('restore', this.config.name, { configData })
      return data
    } catch (error) {
      logger.error(`Failed to restore configuration for ${this.config.name}:`, error.message)
      throw error
    }
  }

  // Health Check
  async healthCheck() {
    try {
      const systemInfo = await this.getSystemInfo()
      const portStatus = await this.getPortStatus()
      
      return {
        switch: this.config.name,
        ip: this.config.ip,
        authenticated: this.authenticated,
        lastAuthTime: this.lastAuthTime,
        systemInfo,
        portStatus,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      logger.error(`Health check failed for ${this.config.name}:`, error.message)
      return {
        switch: this.config.name,
        ip: this.config.ip,
        authenticated: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }
    }
  }

  // Cleanup
  async cleanup() {
    logger.info(`🧹 Cleaning up Vimins manager for ${this.config.name}`)
    this.authenticated = false
    this.lastAuthTime = null
    this.session = null
  }
}

module.exports = ViminsManager
