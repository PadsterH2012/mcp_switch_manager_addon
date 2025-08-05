/**
 * VLAN Management MCP Tools
 * Comprehensive VLAN management capabilities
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
 * Create a new VLAN across specified switches
 */
async function createVLAN(params) {
  const { vlan_id, vlan_name, target_switches = null, description = '' } = params
  
  if (!vlan_id || !vlan_name) {
    throw new Error('vlan_id and vlan_name are required')
  }
  
  const services = getServices()
  const result = await services.vlanManager.createVLAN(vlan_id, vlan_name, target_switches, description)
  
  return {
    success: true,
    message: `VLAN ${vlan_id} (${vlan_name}) created successfully`,
    data: result
  }
}

/**
 * Delete VLAN from specified switches with safety checks
 */
async function deleteVLAN(params) {
  const { vlan_id, target_switches = null, force = false } = params
  
  if (!vlan_id) {
    throw new Error('vlan_id is required')
  }
  
  const services = getServices()
  const result = await services.vlanManager.deleteVLAN(vlan_id, target_switches, force)
  
  return {
    success: true,
    message: `VLAN ${vlan_id} deleted successfully`,
    data: result
  }
}

/**
 * List all VLANs with optional detailed information
 */
async function listVLANs(params) {
  const { switch_id = null, include_details = true } = params
  
  const services = getServices()
  const vlans = await services.vlanManager.listVLANs(switch_id, include_details)
  
  return {
    success: true,
    message: switch_id ? `VLANs listed for switch ${switch_id}` : 'All VLANs listed',
    data: vlans
  }
}

/**
 * Get detailed information about a specific VLAN
 */
async function getVLANInfo(params) {
  const { vlan_id, switch_id = null } = params
  
  if (!vlan_id) {
    throw new Error('vlan_id is required')
  }
  
  const services = getServices()
  const vlans = await services.vlanManager.listVLANs(switch_id, true)
  
  // Find the specific VLAN across all switches
  const vlanInfo = {}
  Object.entries(vlans).forEach(([sId, data]) => {
    if (data.success) {
      const vlan = data.vlans.find(v => v.id == vlan_id)
      if (vlan) {
        vlanInfo[sId] = vlan
      }
    }
  })
  
  if (Object.keys(vlanInfo).length === 0) {
    throw new Error(`VLAN ${vlan_id} not found`)
  }
  
  return {
    success: true,
    message: `VLAN ${vlan_id} information retrieved`,
    data: {
      vlan_id,
      switches: vlanInfo,
      summary: {
        total_switches: Object.keys(vlanInfo).length,
        consistent: Object.values(vlanInfo).every(v => v.name === Object.values(vlanInfo)[0].name)
      }
    }
  }
}

/**
 * Assign a port to a VLAN with tagged or untagged membership
 */
async function assignPortToVLAN(params) {
  const { switch_id, port_id, vlan_id, tagged = false } = params
  
  if (!switch_id || !port_id || !vlan_id) {
    throw new Error('switch_id, port_id, and vlan_id are required')
  }
  
  const services = getServices()
  const result = await services.vlanManager.assignPortToVLAN(switch_id, port_id, vlan_id, tagged)
  
  return {
    success: true,
    message: `Port ${port_id} assigned to VLAN ${vlan_id} on ${switch_id} (${tagged ? 'tagged' : 'untagged'})`,
    data: result
  }
}

/**
 * Remove port from VLAN membership
 */
async function removePortFromVLAN(params) {
  const { switch_id, port_id, vlan_id } = params
  
  if (!switch_id || !port_id || !vlan_id) {
    throw new Error('switch_id, port_id, and vlan_id are required')
  }
  
  const services = getServices()
  const result = await services.vlanManager.removePortFromVLAN(switch_id, port_id, vlan_id)
  
  return {
    success: true,
    message: `Port ${port_id} removed from VLAN ${vlan_id} on ${switch_id}`,
    data: result
  }
}

/**
 * Set Port VLAN ID (PVID) for untagged traffic on access ports
 */
async function setPortPVID(params) {
  const { switch_id, port_id, vlan_id } = params
  
  if (!switch_id || !port_id || !vlan_id) {
    throw new Error('switch_id, port_id, and vlan_id are required')
  }
  
  const services = getServices()
  const result = await services.vlanManager.setPortPVID(switch_id, port_id, vlan_id)
  
  return {
    success: true,
    message: `PVID ${vlan_id} set on port ${port_id} for ${switch_id}`,
    data: result
  }
}

/**
 * Configure port as trunk with specified VLAN allowlist
 */
async function configureTrunkPort(params) {
  const { switch_id, port_id, allowed_vlans, native_vlan = 1 } = params
  
  if (!switch_id || !port_id || !allowed_vlans) {
    throw new Error('switch_id, port_id, and allowed_vlans are required')
  }
  
  if (!Array.isArray(allowed_vlans)) {
    throw new Error('allowed_vlans must be an array')
  }
  
  const services = getServices()
  const result = await services.vlanManager.configureTrunkPort(switch_id, port_id, allowed_vlans, native_vlan)
  
  return {
    success: true,
    message: `Trunk port ${port_id} configured on ${switch_id} with ${allowed_vlans.length} VLANs`,
    data: result
  }
}

/**
 * Deploy VLAN configuration across entire network infrastructure
 */
async function deployVLANNetworkWide(params) {
  const { vlan_config } = params
  
  if (!vlan_config) {
    throw new Error('vlan_config is required')
  }
  
  const services = getServices()
  
  // Extract VLAN details from config
  const { vlan_id, vlan_name, description = '', port_assignments = [] } = vlan_config
  
  if (!vlan_id || !vlan_name) {
    throw new Error('vlan_config must include vlan_id and vlan_name')
  }
  
  // Step 1: Create VLAN on all switches
  const createResult = await services.vlanManager.createVLAN(vlan_id, vlan_name, null, description)
  
  // Step 2: Configure port assignments
  const portResults = []
  for (const assignment of port_assignments) {
    try {
      const { switch_id, port_id, tagged = false } = assignment
      const result = await services.vlanManager.assignPortToVLAN(switch_id, port_id, vlan_id, tagged)
      portResults.push({ switch_id, port_id, success: true, result })
    } catch (error) {
      portResults.push({ 
        switch_id: assignment.switch_id, 
        port_id: assignment.port_id, 
        success: false, 
        error: error.message 
      })
    }
  }
  
  // Step 3: Configure trunk ports for inter-switch connectivity
  const topology = services.switchManager.getNetworkTopology()
  const trunkResults = []
  
  for (const [connectionName, connection] of Object.entries(topology.uplinkConnections)) {
    try {
      // Add VLAN to uplink trunk ports
      const switchId = connection.switch.replace('.', '_')
      const primaryCore = connection.primaryCore.replace('.', '_')
      
      // Configure trunk on access switch uplink
      const trunkResult = await services.vlanManager.configureTrunkPort(
        switchId, 
        connection.primaryPort || 'Port9', 
        [vlan_id], 
        1
      )
      
      trunkResults.push({ 
        connection: connectionName, 
        switch: switchId, 
        success: true, 
        result: trunkResult 
      })
    } catch (error) {
      trunkResults.push({ 
        connection: connectionName, 
        success: false, 
        error: error.message 
      })
    }
  }
  
  return {
    success: true,
    message: `VLAN ${vlan_id} deployed network-wide`,
    data: {
      vlan_creation: createResult,
      port_assignments: portResults,
      trunk_configuration: trunkResults,
      summary: {
        vlan_id,
        vlan_name,
        switches_configured: createResult.switches.length,
        ports_configured: portResults.filter(r => r.success).length,
        trunks_configured: trunkResults.filter(r => r.success).length
      }
    }
  }
}

/**
 * Synchronize VLAN configuration from source to target switches
 */
async function syncVLANAcrossSwitches(params) {
  const { vlan_id, source_switch, target_switches } = params
  
  if (!vlan_id || !source_switch || !target_switches) {
    throw new Error('vlan_id, source_switch, and target_switches are required')
  }
  
  const services = getServices()
  
  // Get source VLAN configuration
  const sourceVlans = await services.vlanManager.listVLANs(source_switch, true)
  
  if (!sourceVlans[source_switch] || !sourceVlans[source_switch].success) {
    throw new Error(`Could not retrieve VLAN configuration from source switch ${source_switch}`)
  }
  
  const sourceVlan = sourceVlans[source_switch].vlans.find(v => v.id == vlan_id)
  if (!sourceVlan) {
    throw new Error(`VLAN ${vlan_id} not found on source switch ${source_switch}`)
  }
  
  // Sync to target switches
  const syncResults = []
  
  for (const targetSwitch of target_switches) {
    try {
      // Create VLAN on target switch
      await services.vlanManager.createVLAN(vlan_id, sourceVlan.name, [targetSwitch], sourceVlan.description)
      
      // Sync port assignments if available
      if (sourceVlan.ports) {
        for (const port of sourceVlan.ports) {
          try {
            await services.vlanManager.assignPortToVLAN(targetSwitch, port.port, vlan_id, port.tagged)
          } catch (portError) {
            logger.warn(`Failed to sync port ${port.port} to ${targetSwitch}:`, portError.message)
          }
        }
      }
      
      syncResults.push({ switch: targetSwitch, success: true })
    } catch (error) {
      syncResults.push({ switch: targetSwitch, success: false, error: error.message })
    }
  }
  
  return {
    success: true,
    message: `VLAN ${vlan_id} synchronized from ${source_switch} to ${target_switches.length} switches`,
    data: {
      source_switch,
      source_vlan: sourceVlan,
      sync_results: syncResults,
      summary: {
        successful_syncs: syncResults.filter(r => r.success).length,
        failed_syncs: syncResults.filter(r => !r.success).length
      }
    }
  }
}

/**
 * Validate VLAN configuration consistency across network
 */
async function validateVLANConsistency(params) {
  const { vlan_id = null } = params
  
  const services = getServices()
  const allVlans = await services.vlanManager.listVLANs(null, true)
  
  const inconsistencies = []
  const vlanSummary = {}
  
  // Analyze VLAN consistency
  Object.entries(allVlans).forEach(([switchId, data]) => {
    if (data.success) {
      data.vlans.forEach(vlan => {
        if (vlan_id === null || vlan.id == vlan_id) {
          if (!vlanSummary[vlan.id]) {
            vlanSummary[vlan.id] = {
              id: vlan.id,
              names: new Set(),
              descriptions: new Set(),
              switches: [],
              portCount: 0
            }
          }
          
          vlanSummary[vlan.id].names.add(vlan.name)
          vlanSummary[vlan.id].descriptions.add(vlan.description || '')
          vlanSummary[vlan.id].switches.push(switchId)
          vlanSummary[vlan.id].portCount += (vlan.ports || []).length
        }
      })
    }
  })
  
  // Check for inconsistencies
  Object.values(vlanSummary).forEach(vlan => {
    if (vlan.names.size > 1) {
      inconsistencies.push({
        type: 'name_mismatch',
        vlan_id: vlan.id,
        issue: `VLAN ${vlan.id} has different names across switches`,
        details: Array.from(vlan.names)
      })
    }
    
    if (vlan.descriptions.size > 1) {
      inconsistencies.push({
        type: 'description_mismatch',
        vlan_id: vlan.id,
        issue: `VLAN ${vlan.id} has different descriptions across switches`,
        details: Array.from(vlan.descriptions)
      })
    }
  })
  
  return {
    success: true,
    message: vlan_id ? `VLAN ${vlan_id} consistency validated` : 'All VLANs consistency validated',
    data: {
      consistent: inconsistencies.length === 0,
      inconsistencies,
      vlan_summary: Object.fromEntries(
        Object.entries(vlanSummary).map(([id, data]) => [
          id, {
            ...data,
            names: Array.from(data.names),
            descriptions: Array.from(data.descriptions)
          }
        ])
      ),
      summary: {
        total_vlans: Object.keys(vlanSummary).length,
        inconsistencies_found: inconsistencies.length,
        switches_analyzed: Object.keys(allVlans).length
      }
    }
  }
}

/**
 * Generate topology map showing VLAN propagation paths
 */
async function getVLANTopologyMap(params) {
  const { vlan_id } = params
  
  if (!vlan_id) {
    throw new Error('vlan_id is required')
  }
  
  const services = getServices()
  const topology = services.switchManager.getNetworkTopology()
  const vlans = await services.vlanManager.listVLANs(null, true)
  
  const vlanTopology = {
    vlan_id,
    switches: {},
    connections: [],
    propagation_paths: []
  }
  
  // Map VLAN presence on each switch
  Object.entries(vlans).forEach(([switchId, data]) => {
    if (data.success) {
      const vlan = data.vlans.find(v => v.id == vlan_id)
      vlanTopology.switches[switchId] = {
        has_vlan: !!vlan,
        vlan_info: vlan || null,
        switch_type: switchId.startsWith('vimins') ? 'core' : 'access'
      }
    }
  })
  
  // Map inter-switch connections
  Object.entries(topology.uplinkConnections).forEach(([name, connection]) => {
    const accessSwitch = connection.switch.replace('.', '_')
    const primaryCore = connection.primaryCore.replace('.', '_')
    
    vlanTopology.connections.push({
      name,
      from: accessSwitch,
      to: primaryCore,
      port: connection.primaryPort,
      vlan_propagated: vlanTopology.switches[accessSwitch]?.has_vlan && 
                      vlanTopology.switches[primaryCore]?.has_vlan
    })
  })
  
  // Analyze propagation paths
  const coreSwitch1 = 'vimins_core1'
  const coreSwitch2 = 'vimins_core2'
  
  if (vlanTopology.switches[coreSwitch1]?.has_vlan && 
      vlanTopology.switches[coreSwitch2]?.has_vlan) {
    vlanTopology.propagation_paths.push({
      path: `${coreSwitch1} <-> ${coreSwitch2}`,
      type: 'inter_core',
      status: 'connected'
    })
  }
  
  return {
    success: true,
    message: `VLAN ${vlan_id} topology map generated`,
    data: vlanTopology
  }
}

// Placeholder implementations for remaining tools
async function createVLANTemplate(params) {
  throw new Error('createVLANTemplate not yet implemented')
}

async function deployVLANFromTemplate(params) {
  throw new Error('deployVLANFromTemplate not yet implemented')
}

async function backupVLANConfiguration(params) {
  const services = getServices()
  const vlans = await services.vlanManager.listVLANs(null, true)
  
  return {
    success: true,
    message: 'VLAN configuration backed up',
    data: {
      timestamp: new Date().toISOString(),
      backup_data: vlans
    }
  }
}

async function restoreVLANConfiguration(params) {
  throw new Error('restoreVLANConfiguration not yet implemented')
}

module.exports = {
  createVLAN,
  deleteVLAN,
  listVLANs,
  getVLANInfo,
  assignPortToVLAN,
  removePortFromVLAN,
  setPortPVID,
  configureTrunkPort,
  deployVLANNetworkWide,
  syncVLANAcrossSwitches,
  validateVLANConsistency,
  getVLANTopologyMap,
  createVLANTemplate,
  deployVLANFromTemplate,
  backupVLANConfiguration,
  restoreVLANConfiguration
}
