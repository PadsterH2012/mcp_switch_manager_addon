/**
 * VLAN Manager Service
 * Comprehensive VLAN management across all switches
 */

const config = require('../../utils/config')
const logger = require('../../utils/logger')

class VLANManagerService {
  constructor(switchManagerService) {
    this.switchManager = switchManagerService
    this.initialized = false
    this.vlanTemplates = new Map()
    this.vlanValidationRules = new Map()
  }

  async initialize() {
    try {
      logger.info('🏷️ Initializing VLAN Manager Service')
      
      // Load VLAN templates
      this.loadVLANTemplates()
      
      // Load validation rules
      this.loadValidationRules()
      
      this.initialized = true
      logger.info('✅ VLAN Manager Service initialized')
      
    } catch (error) {
      logger.error('❌ Failed to initialize VLAN Manager Service:', error)
      throw error
    }
  }

  loadVLANTemplates() {
    // Standard VLAN templates
    this.vlanTemplates.set('management', {
      name: 'Management VLAN Template',
      vlanRange: [500, 509],
      trunkAllUplinks: true,
      accessPorts: [],
      securityPolicy: 'management_access',
      description: 'Management network access'
    })
    
    this.vlanTemplates.set('user_access', {
      name: 'User Access VLAN Template',
      vlanRange: [600, 699],
      trunkUplinksOnly: true,
      defaultAccessPorts: true,
      securityPolicy: 'standard_access',
      description: 'Standard user workstation access'
    })
    
    this.vlanTemplates.set('guest_network', {
      name: 'Guest Network VLAN Template',
      vlanRange: [300, 399],
      isolationRequired: true,
      internetOnly: true,
      securityPolicy: 'guest_access',
      description: 'Guest network with internet-only access'
    })
    
    this.vlanTemplates.set('backup_network', {
      name: 'Backup Network VLAN Template',
      vlanRange: [100, 199],
      highPerformance: true,
      mtu: 9216,
      securityPolicy: 'backup_access',
      description: 'High-performance backup network'
    })
    
    logger.info(`📋 Loaded ${this.vlanTemplates.size} VLAN templates`)
  }

  loadValidationRules() {
    // VLAN ID validation rules
    this.vlanValidationRules.set('vlan_id_range', {
      min: 1,
      max: 4094,
      reserved: config.vlans.reserved
    })
    
    // Port assignment validation rules
    this.vlanValidationRules.set('port_assignment', {
      maxVlansPerPort: 100,
      requirePvidForAccess: true,
      preventConflicts: true
    })
    
    // Network topology validation rules
    this.vlanValidationRules.set('topology', {
      requireTrunkOnUplinks: true,
      validatePropagation: true,
      checkInterCoreConnectivity: true
    })
    
    logger.info(`📏 Loaded ${this.vlanValidationRules.size} validation rule sets`)
  }

  // VLAN Creation and Deletion
  async createVLAN(vlanId, vlanName, targetSwitches = null, description = '') {
    try {
      logger.vlanOperation('create_start', vlanId, targetSwitches, { vlanName, description })
      
      // Validate VLAN ID
      this.validateVLANId(vlanId)
      
      // Determine target switches
      const switches = targetSwitches || this.switchManager.getOnlineSwitches().map(s => s.id)
      
      // Check VLAN availability on all target switches
      await this.validateVLANAvailability(vlanId, switches)
      
      // Create VLAN on all target switches
      const results = {}
      const errors = []
      
      for (const switchId of switches) {
        try {
          const result = await this.switchManager.createVLAN(switchId, vlanId, vlanName, description)
          results[switchId] = { success: true, data: result }
          logger.info(`✅ Created VLAN ${vlanId} on ${switchId}`)
        } catch (error) {
          const errorMsg = `Failed to create VLAN ${vlanId} on ${switchId}: ${error.message}`
          errors.push(errorMsg)
          results[switchId] = { success: false, error: error.message }
          logger.error(errorMsg)
        }
      }
      
      // If any creation failed, attempt rollback
      if (errors.length > 0) {
        logger.warn(`VLAN ${vlanId} creation had ${errors.length} failures, attempting rollback`)
        await this.rollbackVLANCreation(vlanId, switches, results)
        throw new Error(`VLAN creation failed: ${errors.join(', ')}`)
      }
      
      logger.vlanOperation('create_success', vlanId, switches, { vlanName, description })
      return {
        success: true,
        vlanId,
        vlanName,
        description,
        switches,
        results
      }
      
    } catch (error) {
      logger.vlanOperation('create_failed', vlanId, targetSwitches, { error: error.message })
      throw error
    }
  }

  async deleteVLAN(vlanId, targetSwitches = null, force = false) {
    try {
      logger.vlanOperation('delete_start', vlanId, targetSwitches, { force })
      
      // Determine target switches
      const switches = targetSwitches || this.switchManager.getOnlineSwitches().map(s => s.id)
      
      // Check VLAN dependencies unless forced
      if (!force) {
        await this.validateVLANDeletion(vlanId, switches)
      }
      
      // Delete VLAN from all target switches
      const results = {}
      const errors = []
      
      for (const switchId of switches) {
        try {
          // Note: Actual deletion method depends on switch type
          // For now, we'll use a generic approach
          const switchInfo = this.switchManager.getSwitch(switchId)
          if (switchInfo.config.type === 'vimins') {
            // Vimins switches might have a delete API
            const result = await switchInfo.manager.apiCall('vlan_delete', { vlanId: vlanId.toString() }, 'POST')
            results[switchId] = { success: true, data: result }
          } else {
            // Sodola switches might require form submission
            const result = await switchInfo.manager.submitForm('/vlan_config.html', 
              new URLSearchParams({
                vlan_id: vlanId.toString(),
                action: 'delete'
              })
            )
            results[switchId] = { success: true, data: result }
          }
          
          logger.info(`✅ Deleted VLAN ${vlanId} from ${switchId}`)
        } catch (error) {
          const errorMsg = `Failed to delete VLAN ${vlanId} from ${switchId}: ${error.message}`
          errors.push(errorMsg)
          results[switchId] = { success: false, error: error.message }
          logger.error(errorMsg)
        }
      }
      
      if (errors.length > 0 && !force) {
        throw new Error(`VLAN deletion failed: ${errors.join(', ')}`)
      }
      
      logger.vlanOperation('delete_success', vlanId, switches, { force })
      return {
        success: true,
        vlanId,
        switches,
        results,
        errors: errors.length > 0 ? errors : undefined
      }
      
    } catch (error) {
      logger.vlanOperation('delete_failed', vlanId, targetSwitches, { error: error.message })
      throw error
    }
  }

  async listVLANs(switchId = null, includeDetails = true) {
    try {
      const switches = switchId ? [switchId] : this.switchManager.getOnlineSwitches().map(s => s.id)
      const vlanData = {}
      
      for (const sId of switches) {
        try {
          const vlanConfig = await this.switchManager.getVLANConfig(sId)
          vlanData[sId] = {
            success: true,
            vlans: this.parseVLANConfig(vlanConfig, includeDetails),
            timestamp: new Date().toISOString()
          }
        } catch (error) {
          vlanData[sId] = {
            success: false,
            error: error.message
          }
        }
      }
      
      return vlanData
    } catch (error) {
      logger.error('Failed to list VLANs:', error.message)
      throw error
    }
  }

  parseVLANConfig(vlanConfig, includeDetails) {
    const vlans = []
    
    // Parse different VLAN config formats from different switch types
    if (vlanConfig.vlan_conf && vlanConfig.vlan_conf.vlans) {
      // Vimins format
      vlanConfig.vlan_conf.vlans.forEach(vlan => {
        vlans.push({
          id: vlan.vlanId || vlan.id,
          name: vlan.vlanName || vlan.name,
          description: vlan.description || '',
          ports: includeDetails ? this.extractVLANPorts(vlanConfig, vlan.vlanId || vlan.id) : undefined
        })
      })
    }
    
    // Parse Sodola format (from HTML tables)
    Object.entries(vlanConfig).forEach(([page, data]) => {
      if (Array.isArray(data)) {
        data.forEach(item => {
          if (item.vlan || item.vid || item['vlan id']) {
            const vlanId = item.vlan || item.vid || item['vlan id']
            if (!vlans.find(v => v.id == vlanId)) {
              vlans.push({
                id: parseInt(vlanId),
                name: item.name || item['vlan name'] || `VLAN${vlanId}`,
                description: item.description || '',
                source: page
              })
            }
          }
        })
      }
    })
    
    return vlans.sort((a, b) => a.id - b.id)
  }

  extractVLANPorts(vlanConfig, vlanId) {
    const ports = []
    
    // Extract port assignments for the VLAN
    if (vlanConfig.vlan_port && vlanConfig.vlan_port.ports) {
      vlanConfig.vlan_port.ports.forEach(port => {
        if (port.vlans && port.vlans.includes(vlanId)) {
          ports.push({
            port: port.portId || port.port,
            tagged: port.tagged || false,
            pvid: port.pvid
          })
        }
      })
    }
    
    return ports
  }

  // Port Assignment Management
  async assignPortToVLAN(switchId, portId, vlanId, tagged = false) {
    try {
      logger.vlanOperation('port_assign', vlanId, [switchId], { portId, tagged })
      
      const vlanConfig = {
        vlanId,
        tagged,
        pvid: tagged ? undefined : vlanId
      }
      
      const result = await this.switchManager.configureVLANPort(switchId, portId, vlanConfig)
      
      logger.info(`✅ Assigned port ${portId} to VLAN ${vlanId} on ${switchId} (tagged: ${tagged})`)
      return result
      
    } catch (error) {
      logger.error(`Failed to assign port ${portId} to VLAN ${vlanId} on ${switchId}:`, error.message)
      throw error
    }
  }

  async removePortFromVLAN(switchId, portId, vlanId) {
    try {
      logger.vlanOperation('port_remove', vlanId, [switchId], { portId })
      
      // Implementation depends on switch type
      const switchInfo = this.switchManager.getSwitch(switchId)
      let result
      
      if (switchInfo.config.type === 'vimins') {
        result = await switchInfo.manager.apiCall('vlan_portEdit', {
          portId,
          vlanId: vlanId.toString(),
          action: 'remove'
        }, 'POST')
      } else {
        result = await switchInfo.manager.submitForm('/vlan_membership.html', 
          new URLSearchParams({
            port: portId,
            vlan_id: vlanId.toString(),
            action: 'remove'
          })
        )
      }
      
      logger.info(`✅ Removed port ${portId} from VLAN ${vlanId} on ${switchId}`)
      return result
      
    } catch (error) {
      logger.error(`Failed to remove port ${portId} from VLAN ${vlanId} on ${switchId}:`, error.message)
      throw error
    }
  }

  async setPortPVID(switchId, portId, vlanId) {
    try {
      logger.vlanOperation('port_pvid', vlanId, [switchId], { portId })
      
      const vlanConfig = {
        pvid: vlanId,
        vlanId // Also ensure the VLAN is assigned
      }
      
      const result = await this.switchManager.configureVLANPort(switchId, portId, vlanConfig)
      
      logger.info(`✅ Set PVID ${vlanId} on port ${portId} for ${switchId}`)
      return result
      
    } catch (error) {
      logger.error(`Failed to set PVID ${vlanId} on port ${portId} for ${switchId}:`, error.message)
      throw error
    }
  }

  async configureTrunkPort(switchId, portId, allowedVlans, nativeVlan = 1) {
    try {
      logger.vlanOperation('trunk_configure', allowedVlans, [switchId], { portId, nativeVlan })
      
      const vlanConfig = {
        mode: 'trunk',
        allowedVlans: allowedVlans,
        nativeVlan: nativeVlan,
        tagged: true
      }
      
      const result = await this.switchManager.configureVLANPort(switchId, portId, vlanConfig)
      
      logger.info(`✅ Configured trunk port ${portId} on ${switchId} with VLANs: ${allowedVlans.join(', ')}`)
      return result
      
    } catch (error) {
      logger.error(`Failed to configure trunk port ${portId} on ${switchId}:`, error.message)
      throw error
    }
  }

  // Validation Methods
  validateVLANId(vlanId) {
    const rules = this.vlanValidationRules.get('vlan_id_range')
    const id = parseInt(vlanId)
    
    if (isNaN(id) || id < rules.min || id > rules.max) {
      throw new Error(`Invalid VLAN ID: ${vlanId}. Must be between ${rules.min} and ${rules.max}`)
    }
    
    if (rules.reserved.includes(id)) {
      throw new Error(`VLAN ID ${id} is reserved and cannot be used`)
    }
    
    return true
  }

  async validateVLANAvailability(vlanId, switches) {
    const conflicts = []
    
    for (const switchId of switches) {
      try {
        const vlans = await this.listVLANs(switchId, false)
        if (vlans[switchId] && vlans[switchId].success) {
          const existingVlan = vlans[switchId].vlans.find(v => v.id == vlanId)
          if (existingVlan) {
            conflicts.push(`VLAN ${vlanId} already exists on ${switchId}`)
          }
        }
      } catch (error) {
        logger.warn(`Could not check VLAN availability on ${switchId}:`, error.message)
      }
    }
    
    if (conflicts.length > 0) {
      throw new Error(`VLAN ID conflicts: ${conflicts.join(', ')}`)
    }
    
    return true
  }

  async validateVLANDeletion(vlanId, switches) {
    const dependencies = []
    
    for (const switchId of switches) {
      try {
        const vlans = await this.listVLANs(switchId, true)
        if (vlans[switchId] && vlans[switchId].success) {
          const vlan = vlans[switchId].vlans.find(v => v.id == vlanId)
          if (vlan && vlan.ports && vlan.ports.length > 0) {
            dependencies.push(`VLAN ${vlanId} has ${vlan.ports.length} port assignments on ${switchId}`)
          }
        }
      } catch (error) {
        logger.warn(`Could not check VLAN dependencies on ${switchId}:`, error.message)
      }
    }
    
    if (dependencies.length > 0) {
      throw new Error(`VLAN has dependencies: ${dependencies.join(', ')}`)
    }
    
    return true
  }

  async rollbackVLANCreation(vlanId, switches, results) {
    logger.warn(`🔄 Rolling back VLAN ${vlanId} creation`)
    
    for (const switchId of switches) {
      if (results[switchId] && results[switchId].success) {
        try {
          await this.deleteVLAN(vlanId, [switchId], true)
          logger.info(`✅ Rolled back VLAN ${vlanId} from ${switchId}`)
        } catch (error) {
          logger.error(`Failed to rollback VLAN ${vlanId} from ${switchId}:`, error.message)
        }
      }
    }
  }

  // Service Status
  getServiceStatus() {
    return {
      initialized: this.initialized,
      templatesLoaded: this.vlanTemplates.size,
      validationRulesLoaded: this.vlanValidationRules.size,
      switchManagerAvailable: !!this.switchManager
    }
  }

  // Cleanup
  async cleanup() {
    logger.info('🧹 Cleaning up VLAN Manager Service')
    this.vlanTemplates.clear()
    this.vlanValidationRules.clear()
    this.initialized = false
    logger.info('✅ VLAN Manager Service cleanup completed')
  }
}

module.exports = VLANManagerService
