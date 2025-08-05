/**
 * Sodola Switch Manager
 * Handles communication with Sodola SL-SWTGW218AS switches via web interface
 */

const axios = require('axios')
const cheerio = require('cheerio')
const FormData = require('form-data')
const tough = require('tough-cookie')
const logger = require('../../utils/logger')

class SodolaManager {
  constructor(switchConfig) {
    this.config = switchConfig
    this.authenticated = false
    this.lastAuthTime = null
    this.authTimeout = 30 * 60 * 1000 // 30 minutes
    
    // Create cookie jar for session management
    this.cookieJar = new tough.CookieJar()
    
    // Configure axios instance
    this.client = axios.create({
      baseURL: `http://${this.config.ip}`,
      timeout: this.config.timeout || 15000,
      headers: {
        'User-Agent': 'MCP-Switch-Manager/1.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive'
      },
      withCredentials: true
    })
    
    // Setup interceptors
    this.setupInterceptors()
  }

  setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      async (config) => {
        // Add cookies to request
        const cookies = await this.cookieJar.getCookieString(config.baseURL + config.url)
        if (cookies) {
          config.headers.Cookie = cookies
        }
        
        logger.debug(`Sodola Web Request: ${config.method?.toUpperCase()} ${config.url}`)
        return config
      },
      (error) => {
        logger.error('Sodola Web Request Error:', error)
        return Promise.reject(error)
      }
    )

    // Response interceptor
    this.client.interceptors.response.use(
      async (response) => {
        // Store cookies from response
        const setCookieHeader = response.headers['set-cookie']
        if (setCookieHeader) {
          for (const cookie of setCookieHeader) {
            await this.cookieJar.setCookie(cookie, response.config.baseURL + response.config.url)
          }
        }
        
        logger.debug(`Sodola Web Response: ${response.status} ${response.config.url}`)
        return response
      },
      (error) => {
        logger.error('Sodola Web Response Error:', {
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
      logger.info(`🔐 Authenticating to Sodola switch: ${this.config.name} (${this.config.ip})`)
      
      // Try basic authentication first
      this.client.defaults.auth = {
        username: this.config.username,
        password: this.config.password
      }
      
      // Test authentication with main page
      const response = await this.client.get('/')
      
      if (response.status === 200) {
        // Check if we got the main interface (not login page)
        const $ = cheerio.load(response.data)
        
        // Look for indicators that we're authenticated
        if ($('title').text().includes('Switch') || 
            $('.main-content').length > 0 || 
            $('frame').length > 0) {
          
          this.authenticated = true
          this.lastAuthTime = Date.now()
          logger.info(`✅ Successfully authenticated to ${this.config.name} via Basic Auth`)
          return true
        }
      }
      
      // If basic auth failed, try form-based login
      await this.formBasedLogin()
      
      return this.authenticated
      
    } catch (error) {
      logger.error(`❌ Authentication failed for ${this.config.name}:`, error.message)
      this.authenticated = false
      throw error
    }
  }

  async formBasedLogin() {
    try {
      // Get login page
      const loginResponse = await this.client.get('/login.html')
      const $ = cheerio.load(loginResponse.data)
      
      // Find login form
      const form = $('form').first()
      if (form.length === 0) {
        throw new Error('Login form not found')
      }
      
      // Extract form data
      const formData = new FormData()
      formData.append('username', this.config.username)
      formData.append('password', this.config.password)
      
      // Add any hidden fields
      form.find('input[type="hidden"]').each((i, element) => {
        const name = $(element).attr('name')
        const value = $(element).attr('value')
        if (name && value) {
          formData.append(name, value)
        }
      })
      
      // Submit login form
      const loginSubmitResponse = await this.client.post('/login', formData, {
        headers: {
          ...formData.getHeaders(),
          'Referer': `http://${this.config.ip}/login.html`
        }
      })
      
      if (loginSubmitResponse.status === 200) {
        // Check if login was successful
        const $result = cheerio.load(loginSubmitResponse.data)
        
        if (!$result('title').text().includes('Login') && 
            !$result('.error').length) {
          
          this.authenticated = true
          this.lastAuthTime = Date.now()
          logger.info(`✅ Successfully authenticated to ${this.config.name} via form login`)
          return true
        }
      }
      
      throw new Error('Form-based login failed')
      
    } catch (error) {
      logger.error(`Form-based login failed for ${this.config.name}:`, error.message)
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

  async getPage(path) {
    try {
      await this.ensureAuthenticated()
      
      const response = await this.client.get(path)
      
      if (response.status === 200) {
        return response.data
      } else {
        throw new Error(`Failed to get page ${path}: ${response.status}`)
      }
      
    } catch (error) {
      logger.error(`Failed to get page ${path} from ${this.config.name}:`, error.message)
      
      // If authentication error, reset auth state
      if (error.response?.status === 401 || error.response?.status === 403) {
        this.authenticated = false
        this.lastAuthTime = null
      }
      
      throw error
    }
  }

  async submitForm(path, formData, options = {}) {
    try {
      await this.ensureAuthenticated()
      
      const response = await this.client.post(path, formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Referer': `http://${this.config.ip}${path}`,
          ...options.headers
        },
        ...options
      })
      
      if (response.status === 200) {
        return response.data
      } else {
        throw new Error(`Form submission failed: ${response.status}`)
      }
      
    } catch (error) {
      logger.error(`Form submission failed for ${path} on ${this.config.name}:`, error.message)
      throw error
    }
  }

  // System Information
  async getSystemInfo() {
    try {
      const pages = ['/system.html', '/admin.html', '/management.html', '/']
      const systemInfo = {}
      
      for (const page of pages) {
        try {
          const html = await this.getPage(page)
          const $ = cheerio.load(html)
          
          // Extract system information from the page
          const info = this.extractSystemInfoFromHTML($)
          if (Object.keys(info).length > 0) {
            systemInfo[page] = info
          }
        } catch (error) {
          logger.debug(`Failed to get ${page} for ${this.config.name}:`, error.message)
        }
      }
      
      return systemInfo
    } catch (error) {
      logger.error(`Failed to get system info for ${this.config.name}:`, error.message)
      throw error
    }
  }

  extractSystemInfoFromHTML($) {
    const info = {}
    
    // Look for common system information patterns
    $('table tr').each((i, row) => {
      const cells = $(row).find('td')
      if (cells.length >= 2) {
        const key = $(cells[0]).text().trim().toLowerCase()
        const value = $(cells[1]).text().trim()
        
        if (key.includes('model') || key.includes('version') || 
            key.includes('mac') || key.includes('serial') ||
            key.includes('uptime') || key.includes('cpu') ||
            key.includes('memory')) {
          info[key] = value
        }
      }
    })
    
    // Look for specific elements
    const title = $('title').text()
    if (title) {
      info.page_title = title
    }
    
    return info
  }

  // Port Management
  async getPortStatus() {
    try {
      const pages = ['/port.html', '/port_config.html', '/interface.html', '/ports.html']
      const portInfo = {}
      
      for (const page of pages) {
        try {
          const html = await this.getPage(page)
          const $ = cheerio.load(html)
          
          const ports = this.extractPortInfoFromHTML($)
          if (ports.length > 0) {
            portInfo[page] = ports
          }
        } catch (error) {
          logger.debug(`Failed to get ${page} for ${this.config.name}:`, error.message)
        }
      }
      
      return portInfo
    } catch (error) {
      logger.error(`Failed to get port status for ${this.config.name}:`, error.message)
      throw error
    }
  }

  extractPortInfoFromHTML($) {
    const ports = []
    
    // Look for port tables
    $('table').each((i, table) => {
      const headers = []
      $(table).find('tr').first().find('th, td').each((j, header) => {
        headers.push($(header).text().trim().toLowerCase())
      })
      
      // Check if this looks like a port table
      if (headers.some(h => h.includes('port') || h.includes('interface'))) {
        $(table).find('tr').slice(1).each((k, row) => {
          const port = {}
          $(row).find('td').each((l, cell) => {
            if (headers[l]) {
              port[headers[l]] = $(cell).text().trim()
            }
          })
          
          if (Object.keys(port).length > 0) {
            ports.push(port)
          }
        })
      }
    })
    
    return ports
  }

  async configurePort(portId, config) {
    try {
      // Get port configuration page
      const html = await this.getPage('/port_config.html')
      const $ = cheerio.load(html)

      // Find the form for port configuration
      const form = $('form').first()
      if (form.length === 0) {
        throw new Error('Port configuration form not found')
      }

      // Prepare form data
      const formData = new URLSearchParams()
      formData.append('port', portId)

      // Add configuration parameters
      Object.entries(config).forEach(([key, value]) => {
        formData.append(key, value)
      })

      // Submit configuration
      const result = await this.submitForm('/port_config.html', formData)

      logger.switchOperation('port_configure', this.config.name, { portId, config })
      return result
    } catch (error) {
      logger.error(`Failed to configure port ${portId} on ${this.config.name}:`, error.message)
      throw error
    }
  }

  // VLAN Management
  async getVLANConfig() {
    try {
      const pages = ['/vlan.html', '/vlan_config.html', '/vlan_membership.html']
      const vlanInfo = {}

      for (const page of pages) {
        try {
          const html = await this.getPage(page)
          const $ = cheerio.load(html)

          const vlans = this.extractVLANInfoFromHTML($)
          if (vlans.length > 0) {
            vlanInfo[page] = vlans
          }
        } catch (error) {
          logger.debug(`Failed to get ${page} for ${this.config.name}:`, error.message)
        }
      }

      return vlanInfo
    } catch (error) {
      logger.error(`Failed to get VLAN config for ${this.config.name}:`, error.message)
      throw error
    }
  }

  extractVLANInfoFromHTML($) {
    const vlans = []

    // Look for VLAN tables
    $('table').each((i, table) => {
      const headers = []
      $(table).find('tr').first().find('th, td').each((j, header) => {
        headers.push($(header).text().trim().toLowerCase())
      })

      // Check if this looks like a VLAN table
      if (headers.some(h => h.includes('vlan') || h.includes('vid'))) {
        $(table).find('tr').slice(1).each((k, row) => {
          const vlan = {}
          $(row).find('td').each((l, cell) => {
            if (headers[l]) {
              vlan[headers[l]] = $(cell).text().trim()
            }
          })

          if (Object.keys(vlan).length > 0) {
            vlans.push(vlan)
          }
        })
      }
    })

    return vlans
  }

  async createVLAN(vlanId, vlanName, description = '') {
    try {
      // Get VLAN configuration page
      const html = await this.getPage('/vlan_config.html')
      const $ = cheerio.load(html)

      // Prepare form data for VLAN creation
      const formData = new URLSearchParams()
      formData.append('vlan_id', vlanId.toString())
      formData.append('vlan_name', vlanName)
      formData.append('description', description)
      formData.append('action', 'create')

      // Submit VLAN creation
      const result = await this.submitForm('/vlan_config.html', formData)

      logger.vlanOperation('create', vlanId, [this.config.name], { vlanName, description })
      return result
    } catch (error) {
      logger.error(`Failed to create VLAN ${vlanId} on ${this.config.name}:`, error.message)
      throw error
    }
  }

  async configureVLANPort(portId, vlanConfig) {
    try {
      // Get VLAN membership page
      const html = await this.getPage('/vlan_membership.html')
      const $ = cheerio.load(html)

      // Prepare form data
      const formData = new URLSearchParams()
      formData.append('port', portId)
      formData.append('vlan_id', vlanConfig.vlanId.toString())
      formData.append('tagged', vlanConfig.tagged ? '1' : '0')

      if (vlanConfig.pvid) {
        formData.append('pvid', vlanConfig.pvid.toString())
      }

      // Submit VLAN port configuration
      const result = await this.submitForm('/vlan_membership.html', formData)

      logger.vlanOperation('port_configure', vlanConfig.vlanId, [this.config.name], { portId, vlanConfig })
      return result
    } catch (error) {
      logger.error(`Failed to configure VLAN on port ${portId} for ${this.config.name}:`, error.message)
      throw error
    }
  }

  // Configuration Backup/Restore
  async backupConfiguration() {
    try {
      // Try different backup endpoints
      const backupEndpoints = ['/backup.html', '/config_backup.html', '/export.html']

      for (const endpoint of backupEndpoints) {
        try {
          const html = await this.getPage(endpoint)
          const $ = cheerio.load(html)

          // Look for download links
          const downloadLinks = $('a[href*="backup"], a[href*="config"], a[href*="export"]')

          if (downloadLinks.length > 0) {
            const downloadUrl = $(downloadLinks[0]).attr('href')
            const configResponse = await this.client.get(downloadUrl)

            if (configResponse.status === 200) {
              const configData = {
                timestamp: new Date().toISOString(),
                switch: this.config.name,
                ip: this.config.ip,
                configFile: configResponse.data,
                systemInfo: await this.getSystemInfo(),
                portConfig: await this.getPortStatus(),
                vlanConfig: await this.getVLANConfig()
              }

              logger.configurationChange('backup', this.config.name, { endpoint, size: JSON.stringify(configData).length })
              return configData
            }
          }
        } catch (error) {
          logger.debug(`Backup endpoint ${endpoint} failed for ${this.config.name}:`, error.message)
        }
      }

      // If no backup file available, create comprehensive config backup
      const configData = {
        timestamp: new Date().toISOString(),
        switch: this.config.name,
        ip: this.config.ip,
        systemInfo: await this.getSystemInfo(),
        portConfig: await this.getPortStatus(),
        vlanConfig: await this.getVLANConfig()
      }

      logger.configurationChange('backup', this.config.name, { type: 'comprehensive', size: JSON.stringify(configData).length })
      return configData
    } catch (error) {
      logger.error(`Failed to backup configuration for ${this.config.name}:`, error.message)
      throw error
    }
  }

  async restoreConfiguration(configData) {
    try {
      // Try to find restore page
      const restorePages = ['/restore.html', '/config_restore.html', '/import.html']

      for (const page of restorePages) {
        try {
          const html = await this.getPage(page)
          const $ = cheerio.load(html)

          // Look for file upload form
          const fileInput = $('input[type="file"]')
          if (fileInput.length > 0) {
            // Create form data for file upload
            const formData = new FormData()
            formData.append('config_file', JSON.stringify(configData), 'config.json')

            const result = await this.submitForm(page, formData, {
              headers: formData.getHeaders()
            })

            logger.configurationChange('restore', this.config.name, { page })
            return result
          }
        } catch (error) {
          logger.debug(`Restore page ${page} failed for ${this.config.name}:`, error.message)
        }
      }

      throw new Error('No working restore method found')
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
    logger.info(`🧹 Cleaning up Sodola manager for ${this.config.name}`)
    this.authenticated = false
    this.lastAuthTime = null
    this.cookieJar = new tough.CookieJar()
  }
}

module.exports = SodolaManager
