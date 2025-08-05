#!/usr/bin/env node
/**
 * Switch Configuration Validation Tool
 * Validates switch configurations for the MCP Switch Manager Addon
 */

const config = require('../utils/config')

function validateSwitchConfigurations() {
  console.log('🔍 Validating switch configurations...')
  
  const errors = []
  const warnings = []
  
  try {
    // Validate switch configuration structure
    const allSwitches = config.getAllSwitches()
    
    if (Object.keys(allSwitches).length === 0) {
      errors.push('No switches configured')
    }
    
    // Validate each switch configuration
    Object.entries(allSwitches).forEach(([switchId, switchConfig]) => {
      // Validate required fields
      if (!switchConfig.ip) {
        errors.push(`Switch ${switchId}: Missing IP address`)
      }
      
      if (!switchConfig.type) {
        errors.push(`Switch ${switchId}: Missing switch type`)
      }
      
      if (!switchConfig.name) {
        warnings.push(`Switch ${switchId}: Missing switch name`)
      }
      
      // Validate IP format
      if (switchConfig.ip && !isValidIP(switchConfig.ip)) {
        errors.push(`Switch ${switchId}: Invalid IP address format: ${switchConfig.ip}`)
      }
      
      // Validate switch type
      if (switchConfig.type && !['vimins', 'sodola'].includes(switchConfig.type)) {
        errors.push(`Switch ${switchId}: Invalid switch type: ${switchConfig.type}`)
      }
      
      // Validate credentials
      if (!switchConfig.username || !switchConfig.password) {
        warnings.push(`Switch ${switchId}: Missing authentication credentials`)
      }
    })
    
    // Validate VLAN configuration
    const vlanConfig = config.vlans
    if (vlanConfig.reserved && vlanConfig.reserved.length === 0) {
      warnings.push('No reserved VLANs configured')
    }
    
    // Validate topology configuration
    const topology = config.getTopology()
    if (!topology.interCoreLinks || Object.keys(topology.interCoreLinks).length === 0) {
      warnings.push('No inter-core links configured')
    }
    
    if (!topology.uplinkConnections || Object.keys(topology.uplinkConnections).length === 0) {
      warnings.push('No uplink connections configured')
    }
    
    // Report results
    console.log(`✅ Configuration validation completed`)
    console.log(`   Switches configured: ${Object.keys(allSwitches).length}`)
    console.log(`   Errors found: ${errors.length}`)
    console.log(`   Warnings: ${warnings.length}`)
    
    if (errors.length > 0) {
      console.log('\n❌ Errors:')
      errors.forEach(error => console.log(`   - ${error}`))
    }
    
    if (warnings.length > 0) {
      console.log('\n⚠️ Warnings:')
      warnings.forEach(warning => console.log(`   - ${warning}`))
    }
    
    // Exit with error code if there are errors
    if (errors.length > 0) {
      process.exit(1)
    }
    
    console.log('\n🎯 Switch configuration validation passed!')
    
  } catch (error) {
    console.error('❌ Configuration validation failed:', error.message)
    process.exit(1)
  }
}

function isValidIP(ip) {
  const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
  return ipRegex.test(ip)
}

// Run validation if called directly
if (require.main === module) {
  validateSwitchConfigurations()
}

module.exports = { validateSwitchConfigurations }
