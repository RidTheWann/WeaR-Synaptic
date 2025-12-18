//! Application state management with thread-safe access

use crate::config::{McpConfig, McpServer};
use crate::inspector::InspectorMessage;
use std::collections::HashMap;
use std::sync::Mutex;

/// Main application state managed by Tauri
pub struct AppState {
    /// Cached MCP configuration (to avoid repeated file reads)
    pub config_cache: Mutex<Option<McpConfig>>,

    /// Active inspector sessions by server name
    pub inspector_sessions: Mutex<HashMap<String, InspectorSessionState>>,

    /// Captured inspector messages by server name
    pub inspector_messages: Mutex<HashMap<String, Vec<InspectorMessage>>>,
}

impl AppState {
    /// Create a new AppState instance
    pub fn new() -> Self {
        Self {
            config_cache: Mutex::new(None),
            inspector_sessions: Mutex::new(HashMap::new()),
            inspector_messages: Mutex::new(HashMap::new()),
        }
    }

    /// Get the cached config or read from file
    pub fn get_config(&self) -> crate::error::SynapticResult<McpConfig> {
        let mut cache = self.config_cache.lock().unwrap();

        if let Some(ref config) = *cache {
            return Ok(config.clone());
        }

        let config = crate::config::read_config_file()?;
        *cache = Some(config.clone());
        Ok(config)
    }

    /// Update the cached config and write to file
    pub fn set_config(&self, config: McpConfig) -> crate::error::SynapticResult<()> {
        crate::config::write_config_file(&config)?;
        let mut cache = self.config_cache.lock().unwrap();
        *cache = Some(config);
        Ok(())
    }

    /// Invalidate the config cache (force re-read from disk)
    pub fn invalidate_cache(&self) {
        let mut cache = self.config_cache.lock().unwrap();
        *cache = None;
    }

    /// Add a server to the configuration
    pub fn add_server(&self, name: String, server: McpServer) -> crate::error::SynapticResult<()> {
        let mut config = self.get_config()?;

        if config.mcp_servers.contains_key(&name) {
            return Err(crate::error::SynapticError::ServerAlreadyExists(name));
        }

        config.mcp_servers.insert(name, server);
        self.set_config(config)
    }

    /// Remove a server from the configuration
    pub fn remove_server(&self, name: &str) -> crate::error::SynapticResult<()> {
        let mut config = self.get_config()?;

        if config.mcp_servers.remove(name).is_none() {
            return Err(crate::error::SynapticError::ServerNotFound(name.to_string()));
        }

        self.set_config(config)
    }

    /// Update an existing server
    pub fn update_server(&self, name: &str, server: McpServer) -> crate::error::SynapticResult<()> {
        let mut config = self.get_config()?;

        if !config.mcp_servers.contains_key(name) {
            return Err(crate::error::SynapticError::ServerNotFound(name.to_string()));
        }

        config.mcp_servers.insert(name.to_string(), server);
        self.set_config(config)
    }

    /// Toggle server enabled state
    pub fn toggle_server(&self, name: &str, enabled: bool) -> crate::error::SynapticResult<()> {
        let mut config = self.get_config()?;

        let server = config
            .mcp_servers
            .get_mut(name)
            .ok_or_else(|| crate::error::SynapticError::ServerNotFound(name.to_string()))?;

        server.enabled = enabled;
        self.set_config(config)
    }

    /// Add an inspector message
    pub fn add_inspector_message(&self, server_name: &str, message: InspectorMessage) {
        let mut messages = self.inspector_messages.lock().unwrap();
        messages
            .entry(server_name.to_string())
            .or_insert_with(Vec::new)
            .push(message);
    }

    /// Get inspector messages for a server
    pub fn get_inspector_messages(&self, server_name: &str) -> Vec<InspectorMessage> {
        let messages = self.inspector_messages.lock().unwrap();
        messages.get(server_name).cloned().unwrap_or_default()
    }

    /// Clear inspector messages for a server
    pub fn clear_inspector_messages(&self, server_name: &str) {
        let mut messages = self.inspector_messages.lock().unwrap();
        messages.remove(server_name);
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}

/// State for an active inspector session
#[derive(Debug, Clone)]
pub struct InspectorSessionState {
    pub server_name: String,
    pub is_active: bool,
}
