//! MCP Configuration data structures and file I/O operations

use crate::error::{SynapticError, SynapticResult};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

// ============================================
// MCP CONFIGURATION SCHEMA
// ============================================

/// Root configuration structure matching Claude Desktop's config format
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct McpConfig {
    /// Map of server name to server configuration
    #[serde(default)]
    pub mcp_servers: HashMap<String, McpServer>,

    /// Preserve any unknown fields for forward compatibility
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
}

/// Individual MCP server configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpServer {
    /// Command to execute (e.g., "npx", "uvx", "node")
    pub command: String,

    /// Arguments passed to the command
    #[serde(default)]
    pub args: Vec<String>,

    /// Environment variables for the server process
    #[serde(default)]
    pub env: HashMap<String, String>,

    /// Optional working directory
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cwd: Option<String>,

    /// Server enabled/disabled state (Synaptic extension)
    #[serde(default = "default_true")]
    pub enabled: bool,
}

fn default_true() -> bool {
    true
}

/// Backup file information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupInfo {
    pub id: String,
    pub filename: String,
    pub created_at: DateTime<Utc>,
    pub size_bytes: u64,
}

// ============================================
// PATH RESOLUTION
// ============================================

/// Get the OS-specific path to Claude Desktop config file
pub fn get_claude_config_path() -> SynapticResult<PathBuf> {
    #[cfg(target_os = "macos")]
    {
        let home = dirs::home_dir().ok_or_else(|| {
            SynapticError::ConfigNotFound("Could not determine home directory".to_string())
        })?;
        Ok(home.join("Library/Application Support/Claude/claude_desktop_config.json"))
    }

    #[cfg(target_os = "windows")]
    {
        let app_data = dirs::config_dir().ok_or_else(|| {
            SynapticError::ConfigNotFound("Could not determine AppData directory".to_string())
        })?;
        Ok(app_data.join("Claude").join("claude_desktop_config.json"))
    }

    #[cfg(target_os = "linux")]
    {
        let config = dirs::config_dir().ok_or_else(|| {
            SynapticError::ConfigNotFound("Could not determine config directory".to_string())
        })?;
        Ok(config.join("Claude/claude_desktop_config.json"))
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        Err(SynapticError::ConfigNotFound(
            "Unsupported operating system".to_string(),
        ))
    }
}

/// Get the WeaR-Synaptic data directory path
pub fn get_synaptic_data_dir() -> SynapticResult<PathBuf> {
    #[cfg(target_os = "macos")]
    {
        let home = dirs::home_dir().ok_or_else(|| {
            SynapticError::ConfigNotFound("Could not determine home directory".to_string())
        })?;
        Ok(home.join("Library/Application Support/WeaR-Synaptic"))
    }

    #[cfg(target_os = "windows")]
    {
        let app_data = dirs::config_dir().ok_or_else(|| {
            SynapticError::ConfigNotFound("Could not determine AppData directory".to_string())
        })?;
        Ok(app_data.join("WeaR-Synaptic"))
    }

    #[cfg(target_os = "linux")]
    {
        let config = dirs::config_dir().ok_or_else(|| {
            SynapticError::ConfigNotFound("Could not determine config directory".to_string())
        })?;
        Ok(config.join("WeaR-Synaptic"))
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        Err(SynapticError::ConfigNotFound(
            "Unsupported operating system".to_string(),
        ))
    }
}

/// Get the backups directory path
pub fn get_backups_dir() -> SynapticResult<PathBuf> {
    Ok(get_synaptic_data_dir()?.join("backups"))
}

// ============================================
// FILE I/O OPERATIONS
// ============================================

/// Read and parse the MCP configuration file
pub fn read_config_file() -> SynapticResult<McpConfig> {
    let config_path = get_claude_config_path()?;

    if !config_path.exists() {
        // Return empty config if file doesn't exist
        return Ok(McpConfig::default());
    }

    let content = fs::read_to_string(&config_path).map_err(|e| {
        SynapticError::ConfigReadError(format!("Failed to read {}: {}", config_path.display(), e))
    })?;

    let config: McpConfig = serde_json::from_str(&content).map_err(|e| {
        SynapticError::ConfigParseError(format!("Failed to parse {}: {}", config_path.display(), e))
    })?;

    Ok(config)
}

/// Write the MCP configuration file with automatic backup
pub fn write_config_file(config: &McpConfig) -> SynapticResult<()> {
    let config_path = get_claude_config_path()?;

    // Create backup before writing
    if config_path.exists() {
        create_backup()?;
    }

    // Ensure parent directory exists
    if let Some(parent) = config_path.parent() {
        fs::create_dir_all(parent).map_err(|e| {
            SynapticError::ConfigWriteError(format!("Failed to create directory: {}", e))
        })?;
    }

    // Serialize with pretty formatting
    let content = serde_json::to_string_pretty(config).map_err(|e| {
        SynapticError::ConfigWriteError(format!("Failed to serialize config: {}", e))
    })?;

    fs::write(&config_path, content).map_err(|e| {
        SynapticError::ConfigWriteError(format!("Failed to write {}: {}", config_path.display(), e))
    })?;

    Ok(())
}

// ============================================
// BACKUP OPERATIONS
// ============================================

/// Create a backup of the current config file
pub fn create_backup() -> SynapticResult<PathBuf> {
    let config_path = get_claude_config_path()?;
    let backups_dir = get_backups_dir()?;

    // Ensure backups directory exists
    fs::create_dir_all(&backups_dir)
        .map_err(|e| SynapticError::BackupError(format!("Failed to create backups dir: {}", e)))?;

    // Generate backup filename with timestamp
    let timestamp = Utc::now().format("%Y-%m-%dT%H-%M-%S");
    let backup_filename = format!("{}.json", timestamp);
    let backup_path = backups_dir.join(&backup_filename);

    // Copy config to backup
    if config_path.exists() {
        fs::copy(&config_path, &backup_path)
            .map_err(|e| SynapticError::BackupError(format!("Failed to create backup: {}", e)))?;
    }

    Ok(backup_path)
}

/// List all available backups
pub fn list_backups() -> SynapticResult<Vec<BackupInfo>> {
    let backups_dir = get_backups_dir()?;

    if !backups_dir.exists() {
        return Ok(Vec::new());
    }

    let mut backups = Vec::new();

    let entries = fs::read_dir(&backups_dir)
        .map_err(|e| SynapticError::BackupError(format!("Failed to read backups dir: {}", e)))?;

    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().map(|e| e == "json").unwrap_or(false) {
            let metadata = entry.metadata().ok();
            let filename = path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();

            // Parse timestamp from filename
            let id = path
                .file_stem()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();

            backups.push(BackupInfo {
                id: id.clone(),
                filename,
                created_at: Utc::now(), // Would parse from filename in production
                size_bytes: metadata.map(|m| m.len()).unwrap_or(0),
            });
        }
    }

    // Sort by created_at descending (newest first)
    backups.sort_by(|a, b| b.created_at.cmp(&a.created_at));

    Ok(backups)
}

/// Restore configuration from a backup
pub fn restore_from_backup(backup_id: &str) -> SynapticResult<()> {
    let backups_dir = get_backups_dir()?;
    let backup_path = backups_dir.join(format!("{}.json", backup_id));

    if !backup_path.exists() {
        return Err(SynapticError::BackupError(format!(
            "Backup not found: {}",
            backup_id
        )));
    }

    let config_path = get_claude_config_path()?;

    // Create a backup of the current config before restoring
    if config_path.exists() {
        create_backup()?;
    }

    // Copy backup to config path
    fs::copy(&backup_path, &config_path)
        .map_err(|e| SynapticError::BackupError(format!("Failed to restore backup: {}", e)))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_empty_config() {
        let json = r#"{}"#;
        let config: McpConfig = serde_json::from_str(json).unwrap();
        assert!(config.mcp_servers.is_empty());
    }

    #[test]
    fn test_parse_config_with_server() {
        let json = r#"{
            "mcpServers": {
                "filesystem": {
                    "command": "npx",
                    "args": ["-y", "@anthropic-ai/mcp-server-filesystem", "/tmp"]
                }
            }
        }"#;
        let config: McpConfig = serde_json::from_str(json).unwrap();
        assert_eq!(config.mcp_servers.len(), 1);
        assert!(config.mcp_servers.contains_key("filesystem"));
    }

    #[test]
    fn test_serialize_config() {
        let mut config = McpConfig::default();
        config.mcp_servers.insert(
            "test".to_string(),
            McpServer {
                command: "npx".to_string(),
                args: vec!["-y".to_string(), "test-package".to_string()],
                env: HashMap::new(),
                cwd: None,
                enabled: true,
            },
        );

        let json = serde_json::to_string_pretty(&config).unwrap();
        assert!(json.contains("mcpServers"));
        assert!(json.contains("test"));
    }
}
