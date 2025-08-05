/**
 * Test server for MCP Switch Manager Addon
 * Simplified version to test basic functionality
 */

const express = require('express')
const cors = require('cors')

const app = express()
const port = 8087

// Basic middleware
app.use(cors())
app.use(express.json())

// Test route
app.get('/', (req, res) => {
  res.json({
    name: 'MCP Switch Manager Addon',
    version: '1.0.0',
    status: 'running',
    message: 'Test server is working!',
    timestamp: new Date().toISOString()
  })
})

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString()
  })
})

// MCP test endpoint
app.post('/mcp', (req, res) => {
  const { jsonrpc, method, params, id } = req.body
  
  if (method === 'tools/list') {
    res.json({
      jsonrpc: '2.0',
      result: {
        tools: [
          {
            name: 'test_tool',
            description: 'Test tool for MCP Switch Manager',
            inputSchema: {
              type: 'object',
              properties: {
                message: { type: 'string' }
              }
            }
          }
        ]
      },
      id
    })
  } else if (method === 'test_tool') {
    res.json({
      jsonrpc: '2.0',
      result: {
        success: true,
        message: 'MCP Switch Manager test tool executed successfully!',
        params: params || {},
        timestamp: new Date().toISOString()
      },
      id
    })
  } else {
    res.json({
      jsonrpc: '2.0',
      error: {
        code: -32601,
        message: 'Method not found',
        data: `Method '${method}' is not available in test mode`
      },
      id
    })
  }
})

// Start server
app.listen(port, () => {
  console.log(`🌟 MCP Switch Manager Test Server started successfully`)
  console.log(`📍 Server running on port ${port}`)
  console.log(`🔗 Health check: http://localhost:${port}/health`)
  console.log(`🔗 MCP endpoint: http://localhost:${port}/mcp`)
  console.log(`🎯 Test server is ready!`)
})

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully')
  process.exit(0)
})

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully')
  process.exit(0)
})
