#!/usr/bin/env node
/**
 * VLAN Template Validation Tool
 * Validates VLAN templates and configurations for the MCP Switch Manager Addon
 */

const config = require('../utils/config')

function validateVLANTemplates() {
  console.log('🏷️ Validating VLAN templates and configurations...')
  
  const errors = []
  const warnings = []
  
  try {
    // Validate standard VLAN configuration
    const standardVlans = config.vlans.standard
    
    if (!standardVlans || Object.keys(standardVlans).length === 0) {
      warnings.push('No standard VLANs configured')
    } else {
      console.log(`   Standard VLANs configured: ${Object.keys(standardVlans).length}`)
      
      // Validate each VLAN
      Object.entries(standardVlans).forEach(([vlanId, vlanConfig]) => {
        const id = parseInt(vlanId, 10)
        
        // Validate VLAN ID range
        if (isNaN(id) || id < 1 || id > 4094) {
          errors.push(`Invalid VLAN ID: ${vlanId} (must be 1-4094)`)
        }
        
        // Validate VLAN name
        if (!vlanConfig.name || vlanConfig.name.trim() === '') {
          errors.push(`VLAN ${vlanId}: Missing or empty name`)
        }
        
        // Validate VLAN name format (basic check)
        if (vlanConfig.name && !/^[A-Z0-9_-]+$/i.test(vlanConfig.name)) {
          warnings.push(`VLAN ${vlanId}: Name contains special characters: ${vlanConfig.name}`)
        }
        
        // Check for description
        if (!vlanConfig.description) {
          warnings.push(`VLAN ${vlanId}: Missing description`)
        }
      })
    }
    
    // Validate reserved VLANs
    const reservedVlans = config.vlans.reserved
    if (!reservedVlans || reservedVlans.length === 0) {
      warnings.push('No reserved VLANs configured')
    } else {
      console.log(`   Reserved VLANs: ${reservedVlans.length}`)
      
      reservedVlans.forEach(vlanId => {
        if (isNaN(vlanId) || vlanId < 1 || vlanId > 4094) {
          errors.push(`Invalid reserved VLAN ID: ${vlanId}`)
        }
      })
    }
    
    // Check for VLAN ID conflicts
    const allVlanIds = Object.keys(standardVlans).map(id => parseInt(id, 10))
    const duplicates = allVlanIds.filter((id, index) => allVlanIds.indexOf(id) !== index)
    
    if (duplicates.length > 0) {
      errors.push(`Duplicate VLAN IDs found: ${duplicates.join(', ')}`)
    }
    
    // Check for conflicts with reserved VLANs
    const conflicts = allVlanIds.filter(id => reservedVlans.includes(id))
    if (conflicts.length > 0) {
      errors.push(`VLAN IDs conflict with reserved VLANs: ${conflicts.join(', ')}`)
    }
    
    // Validate management VLAN
    const managementVlan = config.vlans.managementVlan
    if (managementVlan) {
      if (!allVlanIds.includes(managementVlan) && !reservedVlans.includes(managementVlan)) {
        warnings.push(`Management VLAN ${managementVlan} is not configured as standard or reserved`)
      }
    }
    
    // Validate VLAN templates (basic structure check)
    const templateValidation = validateVLANTemplateStructure()
    errors.push(...templateValidation.errors)
    warnings.push(...templateValidation.warnings)
    
    // Report results
    console.log(`✅ VLAN template validation completed`)
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
    
    console.log('\n🎯 VLAN template validation passed!')
    
  } catch (error) {
    console.error('❌ VLAN template validation failed:', error.message)
    process.exit(1)
  }
}

function validateVLANTemplateStructure() {
  const errors = []
  const warnings = []
  
  // Define expected VLAN templates
  const expectedTemplates = {
    'management': { range: [500, 509], description: 'Management VLANs' },
    'user_access': { range: [600, 699], description: 'User access VLANs' },
    'guest_network': { range: [300, 399], description: 'Guest network VLANs' },
    'backup_network': { range: [100, 199], description: 'Backup network VLANs' }
  }
  
  // Check if standard VLANs follow template patterns
  const standardVlans = config.vlans.standard
  const vlanIds = Object.keys(standardVlans).map(id => parseInt(id, 10))
  
  Object.entries(expectedTemplates).forEach(([templateName, template]) => {
    const [min, max] = template.range
    const vlansInRange = vlanIds.filter(id => id >= min && id <= max)
    
    if (vlansInRange.length === 0) {
      warnings.push(`No VLANs configured for ${templateName} template (range ${min}-${max})`)
    } else {
      console.log(`   ${templateName} VLANs: ${vlansInRange.length} configured`)
    }
  })
  
  // Check for VLANs outside expected ranges
  const allExpectedRanges = Object.values(expectedTemplates).map(t => t.range)
  const outsideRanges = vlanIds.filter(id => {
    return !allExpectedRanges.some(([min, max]) => id >= min && id <= max) && 
           !config.vlans.reserved.includes(id)
  })
  
  if (outsideRanges.length > 0) {
    warnings.push(`VLANs outside expected template ranges: ${outsideRanges.join(', ')}`)
  }
  
  return { errors, warnings }
}

// Run validation if called directly
if (require.main === module) {
  validateVLANTemplates()
}

module.exports = { validateVLANTemplates }
