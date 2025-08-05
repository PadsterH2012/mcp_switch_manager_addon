/**
 * Switch Management MCP Tools
 * Basic switch management and information retrieval
 */

const logger = require('../utils/logger')

// Get services from global context
function getServices() {
  if (!global.mcpServices) {
    throw new Error('MCP services not initialized')
  }
  return global.mcpServices
}

/**
 * Get detailed information about a specific switch
 */
async function getSwitchInfo(params) {
  const { switch_id } = params
  
  if (!switch_id) {
    throw new Error('switch_id is required')
  }
  
  const services = getServices()
  
  try {
    const switchInfo = services.switchManager.getSwitch(switch_id)
    const manager = services.switchManager.getSwitchManager(switch_id)
    
    // Get comprehensive switch information
    const systemInfo = await manager.getSystemInfo()
    const health = await manager.healthCheck()
    
    return {
      success: true,
      message: `Switch information retrieved for ${switch_id}`,
      data: {
        switch_id,
        config: {
          name: switchInfo.config.name,
          ip: switchInfo.config.ip,
          type: switchInfo.config.type,
          model: switchInfo.config.model
        },
        status: switchInfo.status,
        last_health_check: switchInfo.lastHealthCheck,
        system_info: systemInfo,
        health: health,
        timestamp: new Date().toISOString()
      }
    }
  } catch (error) {
    logger.error(`Failed to get switch info for ${switch_id}:`, error.message)
    throw error
  }
}

/**
 * List all managed switches with status
 */
async function getAllSwitches(params) {
  const { include_details = false } = params
  
  const services = getServices()
  const switches = services.switchManager.getAllSwitches()
  
  let detailedSwitches = switches
  
  if (include_details) {
    detailedSwitches = await Promise.all(
      switches.map(async (switchInfo) => {
        try {
          if (switchInfo.status === 'online') {
            const manager = services.switchManager.getSwitchManager(switchInfo.id)
            const systemInfo = await manager.getSystemInfo()
            return {
              ...switchInfo,
              system_info: systemInfo
            }
          }
          return switchInfo
        } catch (error) {
          return {
            ...switchInfo,
            error: error.message
          }
        }
      })
    )
  }
  
  const summary = {
    total: switches.length,
    online: switches.filter(s => s.status === 'online').length,
    offline: switches.filter(s => s.status === 'offline').length,
    by_type: {
      vimins: switches.filter(s => s.type === 'vimins').length,
      sodola: switches.filter(s => s.type === 'sodola').length
    }
  }
  
  return {
    success: true,
    message: `Retrieved information for ${switches.length} switches`,
    data: {
      switches: detailedSwitches,
      summary,
      timestamp: new Date().toISOString()
    }
  }
}

/**
 * Get current status of a switch
 */
async function getSwitchStatus(params) {
  const { switch_id } = params
  
  if (!switch_id) {
    throw new Error('switch_id is required')
  }
  
  const services = getServices()
  
  try {
    const switchInfo = services.switchManager.getSwitch(switch_id)
    
    let healthCheck = null
    if (switchInfo.status === 'online') {
      const manager = services.switchManager.getSwitchManager(switch_id)
      healthCheck = await manager.healthCheck()
    }
    
    return {
      success: true,
      message: `Status retrieved for switch ${switch_id}`,
      data: {
        switch_id,
        name: switchInfo.config.name,
        ip: switchInfo.config.ip,
        type: switchInfo.config.type,
        status: switchInfo.status,
        last_health_check: switchInfo.lastHealthCheck,
        current_health: healthCheck,
        error: switchInfo.error,
        timestamp: new Date().toISOString()
      }
    }
  } catch (error) {
    logger.error(`Failed to get switch status for ${switch_id}:`, error.message)
    throw error
  }
}

/**
 * Get status of all ports on a switch
 */
async function getPortStatus(params) {
  const { switch_id } = params
  
  if (!switch_id) {
    throw new Error('switch_id is required')
  }
  
  const services = getServices()
  
  try {
    const manager = services.switchManager.getSwitchManager(switch_id)
    const portStatus = await manager.getPortStatus()
    
    return {
      success: true,
      message: `Port status retrieved for switch ${switch_id}`,
      data: {
        switch_id,
        port_status: portStatus,
        timestamp: new Date().toISOString()
      }
    }
  } catch (error) {
    logger.error(`Failed to get port status for ${switch_id}:`, error.message)
    throw error
  }
}

/**
 * Configure port settings
 */
async function configurePort(params) {
  const { switch_id, port_id, config } = params
  
  if (!switch_id || !port_id || !config) {
    throw new Error('switch_id, port_id, and config are required')
  }
  
  const services = getServices()
  
  try {
    const result = await services.switchManager.configurePort(switch_id, port_id, config)
    
    return {
      success: true,
      message: `Port ${port_id} configured on switch ${switch_id}`,
      data: {
        switch_id,
        port_id,
        config,
        result,
        timestamp: new Date().toISOString()
      }
    }
  } catch (error) {
    logger.error(`Failed to configure port ${port_id} on ${switch_id}:`, error.message)
    throw error
  }
}

/**
 * Get network topology information
 */
async function getNetworkTopology(params) {
  const { include_switch_details = false } = params
  
  const services = getServices()
  const topology = services.switchManager.getNetworkTopology()
  
  let enhancedTopology = topology
  
  if (include_switch_details) {
    // Enhance topology with current switch status
    const switchDetails = {}
    
    for (const switchInfo of topology.switches) {
      try {
        if (switchInfo.status === 'online') {
          const manager = services.switchManager.getSwitchManager(switchInfo.id)
          const health = await manager.healthCheck()
          switchDetails[switchInfo.id] = health
        }
      } catch (error) {
        switchDetails[switchInfo.id] = { error: error.message }
      }
    }
    
    enhancedTopology = {
      ...topology,
      switch_details: switchDetails
    }
  }
  
  return {
    success: true,
    message: 'Network topology retrieved',
    data: enhancedTopology
  }
}

/**
 * Discover devices on the network
 */
async function discoverNetworkDevices(params) {
  const { switch_id = null, include_mac_table = true } = params
  
  const services = getServices()
  const switches = switch_id ? [switch_id] : services.switchManager.getOnlineSwitches().map(s => s.id)
  
  const discoveredDevices = {}
  
  for (const sId of switches) {
    try {
      const manager = services.switchManager.getSwitchManager(sId)
      const switchInfo = services.switchManager.getSwitch(sId)
      
      const devices = {
        switch_info: {
          id: sId,
          name: switchInfo.config.name,
          ip: switchInfo.config.ip,
          type: switchInfo.config.type
        },
        discovered_devices: []
      }
      
      if (include_mac_table && switchInfo.config.type === 'vimins') {
        try {
          const macTable = await manager.getMACTable()
          devices.mac_table = macTable
          
          // Extract device information from MAC table
          if (macTable.mac_miscStatus && macTable.mac_miscStatus.entries) {
            devices.discovered_devices = macTable.mac_miscStatus.entries.map(entry => ({
              mac_address: entry.macAddr || entry.mac,
              port: entry.port,
              vlan: entry.vlan || entry.vlanId,
              type: 'learned'
            }))
          }
        } catch (error) {
          devices.mac_table_error = error.message
        }
      }
      
      // For Sodola switches, we might need to parse HTML tables
      if (switchInfo.config.type === 'sodola') {
        try {
          // This would require parsing the web interface
          devices.discovered_devices = [] // Placeholder
        } catch (error) {
          devices.discovery_error = error.message
        }
      }
      
      discoveredDevices[sId] = devices
      
    } catch (error) {
      discoveredDevices[sId] = {
        error: error.message
      }
    }
  }
  
  // Aggregate discovery results
  const allDevices = []
  const devicesByVlan = {}
  const devicesByPort = {}
  
  Object.values(discoveredDevices).forEach(switchData => {
    if (switchData.discovered_devices) {
      switchData.discovered_devices.forEach(device => {
        allDevices.push({
          ...device,
          switch: switchData.switch_info?.name || 'unknown'
        })
        
        // Group by VLAN
        if (device.vlan) {
          if (!devicesByVlan[device.vlan]) {
            devicesByVlan[device.vlan] = []
          }
          devicesByVlan[device.vlan].push(device)
        }
        
        // Group by port
        const portKey = `${switchData.switch_info?.name || 'unknown'}:${device.port}`
        if (!devicesByPort[portKey]) {
          devicesByPort[portKey] = []
        }
        devicesByPort[portKey].push(device)
      })
    }
  })
  
  return {
    success: true,
    message: `Network device discovery completed for ${switches.length} switches`,
    data: {
      switches_scanned: switches,
      discovery_results: discoveredDevices,
      summary: {
        total_devices: allDevices.length,
        devices_by_vlan: devicesByVlan,
        devices_by_port: devicesByPort,
        unique_vlans: Object.keys(devicesByVlan).length,
        active_ports: Object.keys(devicesByPort).length
      },
      timestamp: new Date().toISOString()
    }
  }
}

module.exports = {
  getSwitchInfo,
  getAllSwitches,
  getSwitchStatus,
  getPortStatus,
  configurePort,
  getNetworkTopology,
  discoverNetworkDevices
}
