/**
 * VLAN Tools Unit Tests
 * Tests for VLAN management MCP tools
 */

// Mock the global services
global.mcpServices = {
  vlanManager: {
    createVLAN: jest.fn(),
    deleteVLAN: jest.fn(),
    listVLANs: jest.fn(),
    assignPortToVLAN: jest.fn(),
    removePortFromVLAN: jest.fn(),
    setPortPVID: jest.fn(),
    configureTrunkPort: jest.fn(),
    validateVLANConsistency: jest.fn()
  },
  switchManager: {
    getNetworkTopology: jest.fn(),
    getOnlineSwitches: jest.fn()
  }
}

const vlanTools = require('../../src/tools/vlanTools')

describe('VLAN Management Tools', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('createVLAN', () => {
    test('should create VLAN successfully', async () => {
      const mockResult = {
        success: true,
        vlanId: 100,
        vlanName: 'TEST_VLAN',
        switches: ['vimins_core1', 'vimins_core2']
      }
      
      global.mcpServices.vlanManager.createVLAN.mockResolvedValue(mockResult)
      
      const result = await vlanTools.createVLAN({
        vlan_id: 100,
        vlan_name: 'TEST_VLAN',
        description: 'Test VLAN'
      })
      
      expect(result.success).toBe(true)
      expect(result.message).toContain('TEST_VLAN')
      expect(global.mcpServices.vlanManager.createVLAN).toHaveBeenCalledWith(
        100, 'TEST_VLAN', null, 'Test VLAN'
      )
    })

    test('should throw error for missing parameters', async () => {
      await expect(vlanTools.createVLAN({})).rejects.toThrow('vlan_id and vlan_name are required')
    })
  })

  describe('deleteVLAN', () => {
    test('should delete VLAN successfully', async () => {
      const mockResult = {
        success: true,
        vlanId: 100,
        switches: ['vimins_core1']
      }
      
      global.mcpServices.vlanManager.deleteVLAN.mockResolvedValue(mockResult)
      
      const result = await vlanTools.deleteVLAN({
        vlan_id: 100,
        force: false
      })
      
      expect(result.success).toBe(true)
      expect(result.message).toContain('100')
      expect(global.mcpServices.vlanManager.deleteVLAN).toHaveBeenCalledWith(100, null, false)
    })

    test('should throw error for missing vlan_id', async () => {
      await expect(vlanTools.deleteVLAN({})).rejects.toThrow('vlan_id is required')
    })
  })

  describe('listVLANs', () => {
    test('should list VLANs successfully', async () => {
      const mockVlans = {
        'vimins_core1': {
          success: true,
          vlans: [
            { id: 100, name: 'BACKUP', description: 'Backup network' }
          ]
        }
      }
      
      global.mcpServices.vlanManager.listVLANs.mockResolvedValue(mockVlans)
      
      const result = await vlanTools.listVLANs({
        switch_id: 'vimins_core1',
        include_details: true
      })
      
      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockVlans)
      expect(global.mcpServices.vlanManager.listVLANs).toHaveBeenCalledWith('vimins_core1', true)
    })
  })

  describe('assignPortToVLAN', () => {
    test('should assign port to VLAN successfully', async () => {
      const mockResult = { success: true }
      global.mcpServices.vlanManager.assignPortToVLAN.mockResolvedValue(mockResult)
      
      const result = await vlanTools.assignPortToVLAN({
        switch_id: 'sodola_proxmox',
        port_id: 'Port8',
        vlan_id: 100,
        tagged: false
      })
      
      expect(result.success).toBe(true)
      expect(result.message).toContain('Port8')
      expect(result.message).toContain('100')
      expect(result.message).toContain('untagged')
      expect(global.mcpServices.vlanManager.assignPortToVLAN).toHaveBeenCalledWith(
        'sodola_proxmox', 'Port8', 100, false
      )
    })

    test('should throw error for missing parameters', async () => {
      await expect(vlanTools.assignPortToVLAN({
        switch_id: 'test',
        port_id: 'Port1'
        // missing vlan_id
      })).rejects.toThrow('switch_id, port_id, and vlan_id are required')
    })
  })

  describe('validateVLANConsistency', () => {
    test('should validate VLAN consistency', async () => {
      const mockVlans = {
        'vimins_core1': {
          success: true,
          vlans: [{ id: 100, name: 'BACKUP', description: 'Backup network' }]
        },
        'vimins_core2': {
          success: true,
          vlans: [{ id: 100, name: 'BACKUP', description: 'Backup network' }]
        }
      }
      
      global.mcpServices.vlanManager.listVLANs.mockResolvedValue(mockVlans)
      
      const result = await vlanTools.validateVLANConsistency({ vlan_id: 100 })
      
      expect(result.success).toBe(true)
      expect(result.data.consistent).toBe(true)
      expect(result.data.inconsistencies).toHaveLength(0)
    })
  })
})
