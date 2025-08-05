/**
 * MCP Protocol Integration Tests
 * Tests for MCP JSON-RPC protocol compliance
 */

const request = require('supertest')
const express = require('express')
const mcpRoutes = require('../../src/routes/mcpRoutes')

// Create test app
const app = express()
app.use(express.json())
app.use('/mcp', mcpRoutes)

// Mock global services
global.mcpServices = {
  vlanManager: {
    createVLAN: jest.fn(),
    listVLANs: jest.fn(),
    getServiceStatus: jest.fn()
  },
  switchManager: {
    getAllSwitches: jest.fn(),
    getServiceStatus: jest.fn()
  },
  diagnostics: {
    getServiceStatus: jest.fn()
  }
}

describe('MCP Protocol Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('JSON-RPC 2.0 Compliance', () => {
    test('should handle tools/list request', async () => {
      const response = await request(app)
        .post('/mcp')
        .send({
          jsonrpc: '2.0',
          method: 'tools/list',
          id: 1
        })
        .expect(200)

      expect(response.body.jsonrpc).toBe('2.0')
      expect(response.body.id).toBe(1)
      expect(response.body.result).toBeDefined()
      expect(response.body.result.tools).toBeDefined()
      expect(Array.isArray(response.body.result.tools)).toBe(true)
      expect(response.body.result.tools.length).toBeGreaterThan(0)
    })

    test('should handle ping request', async () => {
      const response = await request(app)
        .post('/mcp')
        .send({
          jsonrpc: '2.0',
          method: 'ping',
          id: 2
        })
        .expect(200)

      expect(response.body.jsonrpc).toBe('2.0')
      expect(response.body.id).toBe(2)
      expect(response.body.result.pong).toBe(true)
      expect(response.body.result.server).toBe('MCP Switch Manager Addon')
    })

    test('should return error for invalid JSON-RPC version', async () => {
      const response = await request(app)
        .post('/mcp')
        .send({
          jsonrpc: '1.0',
          method: 'tools/list',
          id: 3
        })
        .expect(400)

      expect(response.body.jsonrpc).toBe('2.0')
      expect(response.body.error).toBeDefined()
      expect(response.body.error.code).toBe(-32600)
      expect(response.body.error.message).toBe('Invalid Request')
    })

    test('should return error for missing method', async () => {
      const response = await request(app)
        .post('/mcp')
        .send({
          jsonrpc: '2.0',
          id: 4
        })
        .expect(400)

      expect(response.body.jsonrpc).toBe('2.0')
      expect(response.body.error).toBeDefined()
      expect(response.body.error.code).toBe(-32600)
      expect(response.body.error.message).toBe('Invalid Request')
    })

    test('should return error for unknown method', async () => {
      const response = await request(app)
        .post('/mcp')
        .send({
          jsonrpc: '2.0',
          method: 'unknown_method',
          id: 5
        })
        .expect(404)

      expect(response.body.jsonrpc).toBe('2.0')
      expect(response.body.error).toBeDefined()
      expect(response.body.error.code).toBe(-32601)
      expect(response.body.error.message).toBe('Method not found')
    })
  })

  describe('Tool Execution', () => {
    test('should execute create_vlan tool', async () => {
      const mockResult = {
        success: true,
        vlanId: 100,
        vlanName: 'TEST_VLAN'
      }
      
      global.mcpServices.vlanManager.createVLAN.mockResolvedValue(mockResult)

      const response = await request(app)
        .post('/mcp')
        .send({
          jsonrpc: '2.0',
          method: 'create_vlan',
          params: {
            vlan_id: 100,
            vlan_name: 'TEST_VLAN'
          },
          id: 6
        })
        .expect(200)

      expect(response.body.jsonrpc).toBe('2.0')
      expect(response.body.id).toBe(6)
      expect(response.body.result.success).toBe(true)
    })

    test('should handle tool execution errors', async () => {
      global.mcpServices.vlanManager.createVLAN.mockRejectedValue(new Error('Test error'))

      const response = await request(app)
        .post('/mcp')
        .send({
          jsonrpc: '2.0',
          method: 'create_vlan',
          params: {
            vlan_id: 100,
            vlan_name: 'TEST_VLAN'
          },
          id: 7
        })
        .expect(500)

      expect(response.body.jsonrpc).toBe('2.0')
      expect(response.body.id).toBe(7)
      expect(response.body.error).toBeDefined()
      expect(response.body.error.code).toBe(-32603)
      expect(response.body.error.message).toBe('Internal error')
    })
  })

  describe('Health Endpoint', () => {
    test('should return health status', async () => {
      global.mcpServices.switchManager.getServiceStatus.mockReturnValue({
        initialized: true,
        totalSwitches: 5
      })
      
      global.mcpServices.vlanManager.getServiceStatus.mockReturnValue({
        initialized: true
      })

      const response = await request(app)
        .get('/mcp/health')
        .expect(200)

      expect(response.body.status).toBe('healthy')
      expect(response.body.services).toBeDefined()
      expect(response.body.tools).toBeDefined()
    })
  })
})
