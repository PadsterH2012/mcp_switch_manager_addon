/**
 * Configuration Service
 * Manages switch configurations, backups, and compliance
 */

const fs = require('fs').promises
const path = require('path')
const logger = require('../../utils/logger')
const config = require('../../utils/config')

class ConfigurationService {
  constructor(switchManagerService) {
    this.switchManager = switchManagerService
    this.initialized = false
    this.backupDirectory = config.backup.directory
    this.configurationHistory = new Map()
    this.backupScheduler = null
  }

  async initialize() {
    try {
      logger.info('⚙️ Initializing Configuration Service')
      
      // Ensure backup directory exists
      await this.ensureBackupDirectory()
      
      // Start scheduled backups if enabled
      if (config.backup.enabled) {
        this.startScheduledBackups()
      }
      
      this.initialized = true
      logger.info('✅ Configuration Service initialized')
      
    } catch (error) {
      logger.error('❌ Failed to initialize Configuration Service:', error)
      throw error
    }
  }

  async ensureBackupDirectory() {
    try {
      await fs.mkdir(this.backupDirectory, { recursive: true })
      logger.info(`📁 Backup directory ensured: ${this.backupDirectory}`)
    } catch (error) {
      logger.error('Failed to create backup directory:', error)
      throw error
    }
  }

  startScheduledBackups() {
    // This would typically use a cron scheduler
    // For now, we'll use a simple interval
    const interval = 24 * 60 * 60 * 1000 // 24 hours
    
    this.backupScheduler = setInterval(async () => {
      try {
        await this.performScheduledBackup()
      } catch (error) {
        logger.error('Scheduled backup failed:', error)
      }
    }, interval)
    
    logger.info('📅 Scheduled backups started')
  }

  async performScheduledBackup() {
    logger.info('📦 Performing scheduled configuration backup')
    
    try {
      const onlineSwitches = this.switchManager.getOnlineSwitches()
      const backupResults = {}
      
      for (const switchInfo of onlineSwitches) {
        try {
          const backup = await this.createSwitchBackup(switchInfo.id)
          backupResults[switchInfo.id] = { success: true, backup_id: backup.backup_id }
        } catch (error) {
          backupResults[switchInfo.id] = { success: false, error: error.message }
        }
      }
      
      logger.info('📦 Scheduled backup completed', { results: backupResults })
      return backupResults
      
    } catch (error) {
      logger.error('Scheduled backup failed:', error)
      throw error
    }
  }

  async createSwitchBackup(switchId) {
    try {
      const manager = this.switchManager.getSwitchManager(switchId)
      const switchInfo = this.switchManager.getSwitch(switchId)
      
      // Get comprehensive configuration
      const configData = await manager.backupConfiguration()
      
      // Create backup metadata
      const backup = {
        backup_id: this.generateBackupId(switchId),
        switch_id: switchId,
        switch_info: {
          name: switchInfo.config.name,
          ip: switchInfo.config.ip,
          type: switchInfo.config.type,
          model: switchInfo.config.model
        },
        timestamp: new Date().toISOString(),
        config_data: configData,
        backup_type: 'full',
        size: JSON.stringify(configData).length
      }
      
      // Save backup to file
      await this.saveBackupToFile(backup)
      
      // Store in history
      this.storeBackupInHistory(switchId, backup)
      
      logger.configurationChange('backup_created', switchId, { 
        backup_id: backup.backup_id, 
        size: backup.size 
      })
      
      return backup
      
    } catch (error) {
      logger.error(`Failed to create backup for ${switchId}:`, error.message)
      throw error
    }
  }

  generateBackupId(switchId) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    return `${switchId}_${timestamp}`
  }

  async saveBackupToFile(backup) {
    const filename = `${backup.backup_id}.json`
    const filepath = path.join(this.backupDirectory, filename)
    
    try {
      await fs.writeFile(filepath, JSON.stringify(backup, null, 2))
      logger.debug(`Backup saved to file: ${filepath}`)
    } catch (error) {
      logger.error(`Failed to save backup to file: ${filepath}`, error)
      throw error
    }
  }

  storeBackupInHistory(switchId, backup) {
    if (!this.configurationHistory.has(switchId)) {
      this.configurationHistory.set(switchId, [])
    }
    
    const history = this.configurationHistory.get(switchId)
    history.push({
      backup_id: backup.backup_id,
      timestamp: backup.timestamp,
      size: backup.size,
      backup_type: backup.backup_type
    })
    
    // Keep only recent backups in memory
    if (history.length > 50) {
      history.splice(0, history.length - 50)
    }
  }

  async restoreSwitchConfiguration(switchId, backupId) {
    try {
      // Load backup from file
      const backup = await this.loadBackupFromFile(backupId)
      
      if (backup.switch_id !== switchId) {
        throw new Error(`Backup ${backupId} is not for switch ${switchId}`)
      }
      
      // Get switch manager
      const manager = this.switchManager.getSwitchManager(switchId)
      
      // Restore configuration
      const result = await manager.restoreConfiguration(backup.config_data)
      
      logger.configurationChange('restore_completed', switchId, { 
        backup_id: backupId,
        restore_timestamp: new Date().toISOString()
      })
      
      return {
        success: true,
        backup_id: backupId,
        switch_id: switchId,
        restore_result: result,
        timestamp: new Date().toISOString()
      }
      
    } catch (error) {
      logger.error(`Failed to restore configuration for ${switchId}:`, error.message)
      throw error
    }
  }

  async loadBackupFromFile(backupId) {
    const filename = `${backupId}.json`
    const filepath = path.join(this.backupDirectory, filename)
    
    try {
      const data = await fs.readFile(filepath, 'utf8')
      return JSON.parse(data)
    } catch (error) {
      logger.error(`Failed to load backup from file: ${filepath}`, error)
      throw new Error(`Backup ${backupId} not found`)
    }
  }

  async compareConfigurations(switchId1, switchId2) {
    try {
      // Get current configurations
      const config1 = await this.switchManager.backupConfiguration(switchId1)
      const config2 = await this.switchManager.backupConfiguration(switchId2)
      
      // Perform comparison
      const comparison = this.performConfigurationComparison(config1, config2)
      
      return {
        switch1: { id: switchId1, config: config1 },
        switch2: { id: switchId2, config: config2 },
        comparison,
        timestamp: new Date().toISOString()
      }
      
    } catch (error) {
      logger.error('Configuration comparison failed:', error.message)
      throw error
    }
  }

  performConfigurationComparison(config1, config2) {
    const differences = []
    const similarities = []
    
    // Compare system information
    if (config1.systemInfo && config2.systemInfo) {
      this.compareObjects(config1.systemInfo, config2.systemInfo, 'system_info', differences, similarities)
    }
    
    // Compare VLAN configurations
    if (config1.vlanConfig && config2.vlanConfig) {
      this.compareObjects(config1.vlanConfig, config2.vlanConfig, 'vlan_config', differences, similarities)
    }
    
    // Compare port configurations
    if (config1.portConfig && config2.portConfig) {
      this.compareObjects(config1.portConfig, config2.portConfig, 'port_config', differences, similarities)
    }
    
    return {
      differences,
      similarities,
      summary: {
        total_differences: differences.length,
        total_similarities: similarities.length,
        compatibility_score: similarities.length / (similarities.length + differences.length) * 100
      }
    }
  }

  compareObjects(obj1, obj2, category, differences, similarities) {
    // Simple object comparison - in a real implementation, this would be more sophisticated
    const keys1 = Object.keys(obj1)
    const keys2 = Object.keys(obj2)
    
    // Find common keys
    const commonKeys = keys1.filter(key => keys2.includes(key))
    
    commonKeys.forEach(key => {
      if (JSON.stringify(obj1[key]) === JSON.stringify(obj2[key])) {
        similarities.push({
          category,
          field: key,
          description: `${key} values are identical`
        })
      } else {
        differences.push({
          category,
          field: key,
          switch1_value: obj1[key],
          switch2_value: obj2[key]
        })
      }
    })
    
    // Find unique keys
    const uniqueKeys1 = keys1.filter(key => !keys2.includes(key))
    const uniqueKeys2 = keys2.filter(key => !keys1.includes(key))
    
    uniqueKeys1.forEach(key => {
      differences.push({
        category,
        field: key,
        switch1_value: obj1[key],
        switch2_value: 'not present'
      })
    })
    
    uniqueKeys2.forEach(key => {
      differences.push({
        category,
        field: key,
        switch1_value: 'not present',
        switch2_value: obj2[key]
      })
    })
  }

  async listBackups(switchId = null) {
    try {
      const files = await fs.readdir(this.backupDirectory)
      const backupFiles = files.filter(file => file.endsWith('.json'))
      
      const backups = []
      
      for (const file of backupFiles) {
        try {
          const backup = await this.loadBackupFromFile(file.replace('.json', ''))
          
          if (!switchId || backup.switch_id === switchId) {
            backups.push({
              backup_id: backup.backup_id,
              switch_id: backup.switch_id,
              switch_name: backup.switch_info?.name,
              timestamp: backup.timestamp,
              size: backup.size,
              backup_type: backup.backup_type
            })
          }
        } catch (error) {
          logger.warn(`Failed to load backup metadata from ${file}:`, error.message)
        }
      }
      
      // Sort by timestamp (newest first)
      backups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      
      return backups
      
    } catch (error) {
      logger.error('Failed to list backups:', error.message)
      throw error
    }
  }

  async deleteBackup(backupId) {
    try {
      const filename = `${backupId}.json`
      const filepath = path.join(this.backupDirectory, filename)
      
      await fs.unlink(filepath)
      
      logger.info(`Backup deleted: ${backupId}`)
      return { success: true, backup_id: backupId }
      
    } catch (error) {
      logger.error(`Failed to delete backup ${backupId}:`, error.message)
      throw error
    }
  }

  async cleanupOldBackups() {
    try {
      const retentionDays = config.backup.retention
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays)
      
      const backups = await this.listBackups()
      const oldBackups = backups.filter(backup => 
        new Date(backup.timestamp) < cutoffDate
      )
      
      const deletedBackups = []
      
      for (const backup of oldBackups) {
        try {
          await this.deleteBackup(backup.backup_id)
          deletedBackups.push(backup.backup_id)
        } catch (error) {
          logger.warn(`Failed to delete old backup ${backup.backup_id}:`, error.message)
        }
      }
      
      logger.info(`Cleaned up ${deletedBackups.length} old backups`)
      return { deleted_count: deletedBackups.length, deleted_backups: deletedBackups }
      
    } catch (error) {
      logger.error('Failed to cleanup old backups:', error.message)
      throw error
    }
  }

  getConfigurationHistory(switchId, limit = 10) {
    const history = this.configurationHistory.get(switchId) || []
    return history.slice(-limit)
  }

  getServiceStatus() {
    return {
      initialized: this.initialized,
      backup_enabled: config.backup.enabled,
      backup_directory: this.backupDirectory,
      scheduled_backups: !!this.backupScheduler,
      switches_tracked: this.configurationHistory.size
    }
  }

  async cleanup() {
    logger.info('🧹 Cleaning up Configuration Service')
    
    // Stop backup scheduler
    if (this.backupScheduler) {
      clearInterval(this.backupScheduler)
      this.backupScheduler = null
    }
    
    // Clear configuration history
    this.configurationHistory.clear()
    
    this.initialized = false
    logger.info('✅ Configuration Service cleanup completed')
  }
}

module.exports = ConfigurationService
