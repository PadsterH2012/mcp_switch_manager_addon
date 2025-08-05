/**
 * Configuration Unit Tests
 * Tests for the configuration management system
 */

const config = require('../../src/utils/config')

describe('Configuration Management', () => {
  test('should load configuration successfully', () => {
    expect(config).toBeDefined()
    expect(config.port).toBeDefined()
    expect(config.switches).toBeDefined()
  })

  test('should have valid switch configurations', () => {
    const allSwitches = config.getAllSwitches()
    expect(Object.keys(allSwitches).length).toBeGreaterThan(0)
    
    Object.values(allSwitches).forEach(switchConfig => {
      expect(switchConfig.ip).toBeDefined()
      expect(switchConfig.type).toBeDefined()
      expect(['vimins', 'sodola']).toContain(switchConfig.type)
    })
  })

  test('should have valid VLAN configuration', () => {
    expect(config.vlans).toBeDefined()
    expect(config.vlans.standard).toBeDefined()
    expect(config.vlans.reserved).toBeDefined()
    expect(Array.isArray(config.vlans.reserved)).toBe(true)
  })

  test('should validate VLAN IDs correctly', () => {
    expect(config.isVLANReserved(1)).toBe(true)
    expect(config.isVLANReserved(100)).toBe(false)
    expect(config.isVLANReserved(1002)).toBe(true)
  })

  test('should get switch by type', () => {
    const viminsSwitch = config.getSwitchesByType('vimins')
    const sodolaSwitch = config.getSwitchesByType('sodola')
    
    expect(Object.keys(viminsSwitch).length).toBeGreaterThan(0)
    expect(Object.keys(sodolaSwitch).length).toBeGreaterThan(0)
  })

  test('should get VLAN configuration', () => {
    const vlan100 = config.getVLANConfig(100)
    expect(vlan100).toBeDefined()
    expect(vlan100.name).toBe('BACKUP')
  })

  test('should get topology information', () => {
    const topology = config.getTopology()
    expect(topology).toBeDefined()
    expect(topology.interCoreLinks).toBeDefined()
    expect(topology.uplinkConnections).toBeDefined()
  })
})
