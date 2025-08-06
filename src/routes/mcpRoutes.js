/**
 * MCP Protocol Routes - Updated for Standard MCP 2025 Compliance
 * Handles both standard tools/call and legacy direct method calls
 */

const express = require('express')
const logger = require('../utils/logger')

const router = express.Router()

// Import MCP tool handlers
const vlanTools = require('../tools/vlanTools')
const diagnosticTools = require('../tools/diagnosticTools')
const configurationTools = require('../tools/configurationTools')
const switchTools = require('../tools/switchTools')

// MCP tool registry
const mcpTools = new Map()

// Register VLAN management tools
mcpTools.set('create_vlan', vlanTools.createVLAN)
mcpTools.set('delete_vlan', vlanTools.deleteVLAN)
mcpTools.set('list_vlans', vlanTools.listVLANs)
mcpTools.set('get_vlan_info', vlanTools.getVLANInfo)
mcpTools.set('assign_port_to_vlan', vlanTools.assignPortToVLAN)
mcpTools.set('remove_port_from_vlan', vlanTools.removePortFromVLAN)
mcpTools.set('set_port_pvid', vlanTools.setPortPVID)
mcpTools.set('configure_trunk_port', vlanTools.configureTrunkPort)
mcpTools.set('deploy_vlan_network_wide', vlanTools.deployVLANNetworkWide)
mcpTools.set('sync_vlan_across_switches', vlanTools.syncVLANAcrossSwitches)
mcpTools.set('validate_vlan_consistency', vlanTools.validateVLANConsistency)
mcpTools.set('get_vlan_topology_map', vlanTools.getVLANTopologyMap)
mcpTools.set('create_vlan_template', vlanTools.createVLANTemplate)
mcpTools.set('deploy_vlan_from_template', vlanTools.deployVLANFromTemplate)
mcpTools.set('backup_vlan_configuration', vlanTools.backupVLANConfiguration)
mcpTools.set('restore_vlan_configuration', vlanTools.restoreVLANConfiguration)

// Register diagnostic tools
mcpTools.set('network_health_check', diagnosticTools.networkHealthCheck)
mcpTools.set('switch_diagnostics', diagnosticTools.switchDiagnostics)
mcpTools.set('port_diagnostics', diagnosticTools.portDiagnostics)
mcpTools.set('vlan_diagnostics', diagnosticTools.vlanDiagnostics)
mcpTools.set('connectivity_test', diagnosticTools.connectivityTest)
mcpTools.set('performance_analysis', diagnosticTools.performanceAnalysis)
mcpTools.set('real_time_monitoring', diagnosticTools.realTimeMonitoring)

// Register configuration management tools
mcpTools.set('backup_switch_configuration', configurationTools.backupSwitchConfiguration)
mcpTools.set('restore_switch_configuration', configurationTools.restoreSwitchConfiguration)
mcpTools.set('compare_switch_configurations', configurationTools.compareSwitchConfigurations)
mcpTools.set('deploy_configuration_template', configurationTools.deployConfigurationTemplate)
mcpTools.set('validate_configuration_compliance', configurationTools.validateConfigurationCompliance)
mcpTools.set('generate_configuration_report', configurationTools.generateConfigurationReport)
mcpTools.set('rollback_configuration_changes', configurationTools.rollbackConfigurationChanges)

// Register switch management tools
mcpTools.set('get_switch_info', switchTools.getSwitchInfo)
mcpTools.set('get_all_switches', switchTools.getAllSwitches)
mcpTools.set('get_switch_status', switchTools.getSwitchStatus)
mcpTools.set('get_port_status', switchTools.getPortStatus)
mcpTools.set('configure_port', switchTools.configurePort)
mcpTools.set('get_network_topology', switchTools.getNetworkTopology)
mcpTools.set('discover_network_devices', switchTools.discoverNetworkDevices)

// MCP JSON-RPC handler
router.post('/', async (req, res) => {
  const startTime = Date.now()
  
  try {
    const { jsonrpc, method, params, id } = req.body
    
    // Validate JSON-RPC format
    if (jsonrpc !== '2.0') {
      return res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32600,
          message: 'Invalid Request',
          data: 'JSON-RPC version must be 2.0'
        },
        id: id || null
      })
    }
    
    if (!method) {
      return res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32600,
          message: 'Invalid Request',
          data: 'Method is required'
        },
        id: id || null
      })
    }
    
    logger.info(`📞 MCP Request: ${method}`, { params, id, ip: req.ip })
    logger.debug(`🔍 Full request body:`, req.body)
    
    // Handle special MCP methods
    if (method === 'tools/list') {
      const tools = Array.from(mcpTools.keys()).map(name => ({
        name,
        description: getToolDescription(name),
        inputSchema: getToolInputSchema(name)
      }))

      return res.json({
        jsonrpc: '2.0',
        result: { tools },
        id
      })
    }

    // Handle standard MCP tools/call method (MCP 2025 Standard)
    if (method === 'tools/call') {
      logger.debug(`🔍 tools/call received params:`, { params, body: req.body })
      const { name: toolName, arguments: toolArguments } = params || {}
      const toolArgs = toolArguments
      logger.debug(`🔍 Parsed toolName: ${toolName}, toolArgs:`, toolArgs)

      if (!toolName) {
        return res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32602,
            message: 'Invalid params',
            data: 'Tool name is required in tools/call'
          },
          id
        })
      }

      const toolHandler = mcpTools.get(toolName)
      if (!toolHandler) {
        return res.status(404).json({
          jsonrpc: '2.0',
          error: {
            code: -32601,
            message: 'Method not found',
            data: `Tool '${toolName}' is not available`
          },
          id
        })
      }

      try {
        logger.info(`🔧 Executing tool via tools/call: ${toolName}`, { args: toolArgs, id })
        const result = await toolHandler(toolArgs || {})

        const duration = Date.now() - startTime
        logger.info(`✅ MCP tools/call completed: ${toolName} (${duration}ms)`, { id })

        // Return raw result for master-proxy compatibility
        return res.json({
          jsonrpc: '2.0',
          result,
          id
        })

      } catch (toolError) {
        logger.error(`❌ MCP tools/call error: ${toolName}`, {
          error: toolError.message,
          args: toolArgs,
          id,
          stack: toolError.stack
        })

        return res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal error',
            data: toolError.message
          },
          id
        })
      }
    }

    if (method === 'ping') {
      return res.json({
        jsonrpc: '2.0',
        result: {
          pong: true,
          timestamp: new Date().toISOString(),
          server: 'MCP Switch Manager Addon',
          protocol: 'MCP 2025 Standard Compliant'
        },
        id
      })
    }
    
    // Handle tool execution
    const toolHandler = mcpTools.get(method)
    if (!toolHandler) {
      return res.status(404).json({
        jsonrpc: '2.0',
        error: {
          code: -32601,
          message: 'Method not found',
          data: `Tool '${method}' is not available`
        },
        id
      })
    }
    
    // Execute the tool
    try {
      const result = await toolHandler(params || {})
      
      const duration = Date.now() - startTime
      logger.info(`✅ MCP Request completed: ${method} (${duration}ms)`, { id })
      
      res.json({
        jsonrpc: '2.0',
        result,
        id
      })
      
    } catch (toolError) {
      logger.error(`❌ MCP Tool error: ${method}`, { 
        error: toolError.message, 
        params, 
        id,
        stack: toolError.stack 
      })
      
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal error',
          data: toolError.message
        },
        id
      })
    }
    
  } catch (error) {
    logger.error('❌ MCP Request processing error:', { 
      error: error.message, 
      body: req.body,
      stack: error.stack 
    })
    
    res.status(500).json({
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: 'Internal error',
        data: 'Failed to process MCP request'
      },
      id: req.body?.id || null
    })
  }
})

// Tool descriptions for MCP tools/list
function getToolDescription(toolName) {
  const descriptions = {
    // VLAN Management
    'create_vlan': 'Create a new VLAN across specified switches',
    'delete_vlan': 'Delete VLAN from specified switches with safety checks',
    'list_vlans': 'List all VLANs with optional detailed information',
    'get_vlan_info': 'Get detailed information about a specific VLAN',
    'assign_port_to_vlan': 'Assign a port to a VLAN with tagged or untagged membership',
    'remove_port_from_vlan': 'Remove port from VLAN membership',
    'set_port_pvid': 'Set Port VLAN ID (PVID) for untagged traffic on access ports',
    'configure_trunk_port': 'Configure port as trunk with specified VLAN allowlist',
    'deploy_vlan_network_wide': 'Deploy VLAN configuration across entire network',
    'sync_vlan_across_switches': 'Synchronize VLAN configuration between switches',
    'validate_vlan_consistency': 'Validate VLAN configuration consistency across network',
    'get_vlan_topology_map': 'Generate topology map showing VLAN propagation paths',
    'create_vlan_template': 'Create reusable VLAN configuration template',
    'deploy_vlan_from_template': 'Deploy VLAN using predefined template',
    'backup_vlan_configuration': 'Create backup of current VLAN configurations',
    'restore_vlan_configuration': 'Restore VLAN configuration from backup',
    
    // Diagnostics
    'network_health_check': 'Comprehensive network health assessment',
    'switch_diagnostics': 'Detailed diagnostics for specific switch',
    'port_diagnostics': 'Analyze port status and performance',
    'vlan_diagnostics': 'VLAN-specific diagnostic analysis',
    'connectivity_test': 'Test connectivity between network endpoints',
    'performance_analysis': 'Analyze network performance metrics',
    'real_time_monitoring': 'Real-time monitoring of switch metrics',
    
    // Configuration Management
    'backup_switch_configuration': 'Create backup of switch configuration',
    'restore_switch_configuration': 'Restore switch configuration from backup',
    'compare_switch_configurations': 'Compare configurations between switches',
    'deploy_configuration_template': 'Deploy standardized configuration template',
    'validate_configuration_compliance': 'Validate configuration against policies',
    'generate_configuration_report': 'Generate comprehensive configuration report',
    'rollback_configuration_changes': 'Rollback configuration to previous state',
    
    // Switch Management
    'get_switch_info': 'Get detailed information about a specific switch',
    'get_all_switches': 'List all managed switches with status',
    'get_switch_status': 'Get current status of a switch',
    'get_port_status': 'Get status of all ports on a switch',
    'configure_port': 'Configure port settings',
    'get_network_topology': 'Get network topology information',
    'discover_network_devices': 'Discover devices on the network'
  }
  
  return descriptions[toolName] || 'No description available'
}

// Tool input schemas for MCP tools/list
function getToolInputSchema(toolName) {
  const schemas = {
    'create_vlan': {
      type: 'object',
      properties: {
        vlan_id: { type: 'integer', minimum: 1, maximum: 4094 },
        vlan_name: { type: 'string' },
        target_switches: { type: 'array', items: { type: 'string' } },
        description: { type: 'string' }
      },
      required: ['vlan_id', 'vlan_name']
    },
    'delete_vlan': {
      type: 'object',
      properties: {
        vlan_id: { type: 'integer', minimum: 1, maximum: 4094 },
        target_switches: { type: 'array', items: { type: 'string' } },
        force: { type: 'boolean' }
      },
      required: ['vlan_id']
    },
    'list_vlans': {
      type: 'object',
      properties: {
        switch_id: { type: 'string' },
        include_details: { type: 'boolean' }
      }
    },
    'assign_port_to_vlan': {
      type: 'object',
      properties: {
        switch_id: { type: 'string' },
        port_id: { type: 'string' },
        vlan_id: { type: 'integer', minimum: 1, maximum: 4094 },
        tagged: { type: 'boolean' }
      },
      required: ['switch_id', 'port_id', 'vlan_id']
    },
    'network_health_check': {
      type: 'object',
      properties: {
        include_performance: { type: 'boolean' },
        include_topology: { type: 'boolean' }
      }
    },
    'switch_diagnostics': {
      type: 'object',
      properties: {
        switch_id: { type: 'string' },
        include_ports: { type: 'boolean' },
        include_vlans: { type: 'boolean' }
      },
      required: ['switch_id']
    }
  }
  
  return schemas[toolName] || {
    type: 'object',
    properties: {},
    additionalProperties: true
  }
}

// Health check endpoint for MCP
router.get('/health', (req, res) => {
  const services = global.mcpServices
  
  if (!services) {
    return res.status(503).json({
      status: 'unhealthy',
      message: 'MCP services not initialized'
    })
  }
  
  const switchManagerStatus = services.switchManager?.getServiceStatus()
  const vlanManagerStatus = services.vlanManager?.getServiceStatus()
  
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    protocol: 'MCP 2025 Standard Compliant',
    services: {
      switchManager: switchManagerStatus,
      vlanManager: vlanManagerStatus
    },
    tools: {
      total: mcpTools.size,
      available: Array.from(mcpTools.keys())
    }
  })
})

module.exports = router
