# MCP Switch Manager Addon

Comprehensive network switch management MCP addon supporting Vimins and Sodola switches with advanced VLAN management, real-time diagnostics, and configuration automation.

## 🎯 Features

### **Comprehensive VLAN Management (32 Tools)**
- ✅ VLAN creation/deletion across all switches
- ✅ Port assignment (tagged/untagged, PVID configuration)
- ✅ Cross-switch VLAN deployment
- ✅ Trunk port configuration with multiple VLANs
- ✅ VLAN consistency validation
- ✅ Configuration templates and standards
- ✅ Change tracking and rollback capabilities
- ✅ Automated maintenance and reporting

### **Real-time Diagnostics**
- ✅ Network health monitoring
- ✅ Switch-specific diagnostics
- ✅ Port status and performance analysis
- ✅ VLAN diagnostic analysis
- ✅ Connectivity testing
- ✅ Performance metrics collection

### **Configuration Management**
- ✅ Automated configuration backup/restore
- ✅ Configuration comparison between switches
- ✅ Template-based deployment
- ✅ Compliance validation
- ✅ Change tracking with audit trails
- ✅ Git-based version control integration

### **Multi-vendor Support**
- ✅ **Vimins VM-S100-0800MS**: CGI API integration
- ✅ **Sodola SL-SWTGW218AS**: Web interface automation
- ✅ Unified management interface
- ✅ Vendor-specific optimizations

## 🏗️ Architecture

```
MCP Switch Manager Addon
├── Switch Manager Service
│   ├── Vimins Manager (CGI API)
│   └── Sodola Manager (Web Interface)
├── VLAN Manager Service
│   ├── Cross-switch coordination
│   ├── Template management
│   └── Validation engine
├── Diagnostics Service
│   ├── Real-time monitoring
│   ├── Performance analysis
│   └── Health checking
└── Configuration Service
    ├── Backup/restore
    ├── Version control
    └── Compliance checking
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Docker (optional)
- Network access to switches

### Installation

1. **Clone and install dependencies:**
```bash
git clone <repository-url>
cd mcp_switch_manager_addon
npm install
```

2. **Configure environment:**
```bash
cp .env.example .env
# Edit .env with your switch configurations
```

3. **Start the addon:**
```bash
npm start
```

### Docker Deployment

```bash
# Build image
docker build -t mcp-switch-manager .

# Run container
docker run -d \
  --name mcp-switch-manager \
  -p 8087:8087 \
  -e VIMINS_CORE1_IP=10.202.28.9 \
  -e VIMINS_CORE2_IP=10.202.28.10 \
  -e SODOLA_OFFICE_IP=10.202.28.13 \
  -e SODOLA_PROXMOX_IP=10.202.28.12 \
  -e SODOLA_BACKUP_IP=10.202.28.14 \
  mcp-switch-manager
```

## 🔧 Configuration

### Environment Variables

#### **Switch Configuration**
```bash
# Vimins Switches
VIMINS_CORE1_IP=10.202.28.9
VIMINS_CORE2_IP=10.202.28.10
VIMINS_USERNAME=admin
VIMINS_PASSWORD=admin

# Sodola Switches
SODOLA_OFFICE_IP=10.202.28.13
SODOLA_PROXMOX_IP=10.202.28.12
SODOLA_BACKUP_IP=10.202.28.14
SODOLA_USERNAME=admin
SODOLA_PASSWORD=admin
```

#### **Service Configuration**
```bash
MCP_PORT=8087
LOG_LEVEL=info
NODE_ENV=production
HEALTH_CHECK_INTERVAL=300000
BACKUP_ENABLED=true
```

### Network Topology

The addon automatically discovers and manages this network topology:

```
Core Switches (Vimins)
├── Core1 (10.202.28.9) ←→ LAG1 ←→ Core2 (10.202.28.10)
│
Access Switches (Sodola)
├── Office Switch (10.202.28.13) → Core1:TE6
├── Proxmox Switch (10.202.28.12) → Core2:TE6
└── Backup Switch (10.202.28.14) → Core2:TE5
```

## 📡 MCP Tools

### **VLAN Management Tools**

#### Core VLAN Operations
```javascript
// Create VLAN across switches
create_vlan({
  vlan_id: 100,
  vlan_name: "BACKUP",
  target_switches: ["vimins_core1", "vimins_core2"],
  description: "Backup network"
})

// Assign port to VLAN
assign_port_to_vlan({
  switch_id: "sodola_proxmox",
  port_id: "Port8",
  vlan_id: 100,
  tagged: false
})

// Configure trunk port
configure_trunk_port({
  switch_id: "vimins_core1",
  port_id: "LAG1",
  allowed_vlans: [100, 200, 300, 400, 500, 600, 700],
  native_vlan: 1
})
```

#### Advanced VLAN Operations
```javascript
// Deploy VLAN network-wide
deploy_vlan_network_wide({
  vlan_config: {
    vlan_id: 100,
    vlan_name: "BACKUP",
    description: "Backup Infrastructure",
    port_assignments: [
      { switch_id: "sodola_proxmox", port_id: "Port8", tagged: false }
    ]
  }
})

// Validate VLAN consistency
validate_vlan_consistency({ vlan_id: 100 })

// Get VLAN topology map
get_vlan_topology_map({ vlan_id: 100 })
```

### **Diagnostic Tools**

```javascript
// Network health check
network_health_check({
  include_performance: true,
  include_topology: true
})

// Switch diagnostics
switch_diagnostics({
  switch_id: "vimins_core1",
  include_ports: true,
  include_vlans: true
})

// Port diagnostics
port_diagnostics({
  switch_id: "sodola_proxmox",
  port_id: "Port8"
})
```

### **Configuration Management Tools**

```javascript
// Backup configurations
backup_switch_configuration({
  switch_ids: ["vimins_core1", "vimins_core2"]
})

// Compare configurations
compare_switch_configurations({
  switch1_id: "vimins_core1",
  switch2_id: "vimins_core2"
})

// Generate configuration report
generate_configuration_report({
  switch_ids: null, // All switches
  format: "json"
})
```

## 🔍 Real-world Use Cases

### **VLAN 100 Backup Network Setup**

This addon was specifically designed to solve real VLAN management challenges:

```javascript
// 1. Create VLAN 100 on all switches
await create_vlan({
  vlan_id: 100,
  vlan_name: "BACKUP",
  description: "Backup Infrastructure Network"
})

// 2. Configure Proxmox Host Switch Port 8 for PBS
await assign_port_to_vlan({
  switch_id: "sodola_proxmox",
  port_id: "Port8",
  vlan_id: 100,
  tagged: false
})

// 3. Set PVID for untagged traffic
await set_port_pvid({
  switch_id: "sodola_proxmox",
  port_id: "Port8",
  vlan_id: 100
})

// 4. Configure trunk ports for VLAN propagation
await configure_trunk_port({
  switch_id: "vimins_core2",
  port_id: "TE6",
  allowed_vlans: [100, 200, 300, 400, 500, 600, 700]
})

// 5. Validate VLAN consistency
const validation = await validate_vlan_consistency({ vlan_id: 100 })
```

### **Network Health Monitoring**

```javascript
// Comprehensive health check
const health = await network_health_check({
  include_performance: true,
  include_topology: true
})

// Check specific switch
const switchHealth = await switch_diagnostics({
  switch_id: "vimins_core1",
  include_ports: true,
  include_vlans: true
})

// Monitor VLAN 100 specifically
const vlanHealth = await vlan_diagnostics({ vlan_id: 100 })
```

## 🏥 Health Monitoring

### Health Check Endpoints

- **Basic Health**: `GET /health`
- **Detailed Health**: `GET /health/detailed`
- **Readiness**: `GET /health/ready`
- **Liveness**: `GET /health/live`
- **MCP Health**: `GET /mcp/health`

### Monitoring Features

- ✅ Automatic switch connectivity monitoring
- ✅ VLAN consistency checking
- ✅ Performance metrics collection
- ✅ Error rate tracking
- ✅ Automated reconnection on failures

## 🔒 Security

### Authentication
- Switch-specific credentials
- Session management
- Automatic re-authentication
- Secure credential storage

### Network Security
- Rate limiting
- Request validation
- Error sanitization
- Audit logging

## 📊 Logging and Monitoring

### Log Levels
- **ERROR**: Critical failures
- **WARN**: Non-critical issues
- **INFO**: General operations
- **DEBUG**: Detailed debugging

### Specialized Logging
- **Switch Operations**: All switch interactions
- **VLAN Operations**: VLAN management activities
- **Configuration Changes**: All configuration modifications
- **Diagnostic Results**: Health check and diagnostic outcomes

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test suites
npm test -- --testPathPattern=vlan
npm test -- --testPathPattern=switch
```

## 🚀 Deployment

### Production Deployment

1. **Build and push to Harbor registry:**
```bash
docker build -t hl-harbor.techpad.uk/mcp/switch-manager-addon:latest .
docker push hl-harbor.techpad.uk/mcp/switch-manager-addon:latest
```

2. **Deploy with Docker Compose:**
```yaml
version: '3.8'
services:
  switch-manager:
    image: hl-harbor.techpad.uk/mcp/switch-manager-addon:latest
    ports:
      - "8087:8087"
    environment:
      - NODE_ENV=production
      - VIMINS_CORE1_IP=10.202.28.9
      - VIMINS_CORE2_IP=10.202.28.10
      # ... other environment variables
    restart: unless-stopped
```

### CI/CD Pipeline

The addon includes a complete Jenkins pipeline with:
- ✅ Syntax validation
- ✅ Unit testing
- ✅ Security scanning
- ✅ Docker image building
- ✅ Container testing
- ✅ Harbor registry deployment
- ✅ Automated deployment

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Run the test suite
6. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the logs for detailed error information
- Use the health check endpoints for diagnostics

## 🎯 Roadmap

### Phase 1 (Current)
- ✅ Core VLAN management
- ✅ Basic diagnostics
- ✅ Multi-vendor support

### Phase 2 (Next)
- 📋 Advanced VLAN templates
- 📋 Automated remediation
- 📋 Performance optimization

### Phase 3 (Future)
- 📋 AI-powered network optimization
- 📋 Predictive analytics
- 📋 Zero-touch provisioning

---

**The MCP Switch Manager Addon transforms network operations by providing enterprise-grade switch management capabilities with comprehensive VLAN automation, real-time diagnostics, and intelligent configuration management.** 🎯
