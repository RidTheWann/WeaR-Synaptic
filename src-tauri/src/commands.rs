//! Tauri IPC command handlers

use crate::config::{self, BackupInfo, McpConfig, McpServer};
use crate::error::SynapticError;
use crate::inspector::{InspectorMessage, InspectorSession};
use crate::registry::{self, RegistryServer, RuntimeStatus};
use crate::state::AppState;
use tauri::State;

// ============================================
// CONFIG MANAGER COMMANDS
// ============================================

/// Get the OS-specific path to Claude Desktop config
#[tauri::command]
pub async fn get_config_path() -> Result<String, SynapticError> {
    let path = config::get_claude_config_path()?;
    Ok(path.to_string_lossy().to_string())
}

/// Read and parse the current MCP configuration
#[tauri::command]
pub async fn read_config(state: State<'_, AppState>) -> Result<McpConfig, SynapticError> {
    state.get_config()
}

/// Write configuration with automatic backup
#[tauri::command]
pub async fn write_config(
    config: McpConfig,
    state: State<'_, AppState>,
) -> Result<(), SynapticError> {
    state.set_config(config)
}

/// Add a new MCP server to the configuration
#[tauri::command]
pub async fn add_server(
    name: String,
    server: McpServer,
    state: State<'_, AppState>,
) -> Result<(), SynapticError> {
    state.add_server(name, server)
}

/// Remove an MCP server from the configuration
#[tauri::command]
pub async fn remove_server(name: String, state: State<'_, AppState>) -> Result<(), SynapticError> {
    state.remove_server(&name)
}

/// Update an existing MCP server configuration
#[tauri::command]
pub async fn update_server(
    name: String,
    server: McpServer,
    state: State<'_, AppState>,
) -> Result<(), SynapticError> {
    state.update_server(&name, server)
}

/// Toggle server enabled/disabled state
#[tauri::command]
pub async fn toggle_server(
    name: String,
    enabled: bool,
    state: State<'_, AppState>,
) -> Result<(), SynapticError> {
    state.toggle_server(&name, enabled)
}

/// List all configuration backups
#[tauri::command]
pub async fn list_backups() -> Result<Vec<BackupInfo>, SynapticError> {
    config::list_backups()
}

/// Restore configuration from a backup
#[tauri::command]
pub async fn restore_backup(
    backup_id: String,
    state: State<'_, AppState>,
) -> Result<(), SynapticError> {
    config::restore_from_backup(&backup_id)?;
    // Invalidate cache to force re-read
    state.invalidate_cache();
    Ok(())
}

// ============================================
// INSPECTOR COMMANDS
// ============================================

/// Start the inspector for a server (placeholder for full MITM implementation)
#[tauri::command]
pub async fn start_inspector(
    server_name: String,
    state: State<'_, AppState>,
) -> Result<InspectorSession, SynapticError> {
    // Create a new session
    let session = InspectorSession::new(&server_name);

    // Store session state
    {
        let mut sessions = state.inspector_sessions.lock().unwrap();
        sessions.insert(
            server_name.clone(),
            crate::state::InspectorSessionState {
                server_name: server_name.clone(),
                is_active: true,
            },
        );
    }

    Ok(session)
}

/// Stop the inspector for a server
#[tauri::command]
pub async fn stop_inspector(
    server_name: String,
    state: State<'_, AppState>,
) -> Result<(), SynapticError> {
    let mut sessions = state.inspector_sessions.lock().unwrap();

    if let Some(session) = sessions.get_mut(&server_name) {
        session.is_active = false;
    }

    Ok(())
}

/// Get captured messages for a server
#[tauri::command]
pub async fn get_inspector_messages(
    server_name: String,
    limit: Option<usize>,
    offset: Option<usize>,
    state: State<'_, AppState>,
) -> Result<Vec<InspectorMessage>, SynapticError> {
    let messages = state.get_inspector_messages(&server_name);

    let offset = offset.unwrap_or(0);
    let limit = limit.unwrap_or(100);

    let paginated: Vec<_> = messages.into_iter().skip(offset).take(limit).collect();

    Ok(paginated)
}

/// Clear inspector message history
#[tauri::command]
pub async fn clear_inspector_messages(
    server_name: String,
    state: State<'_, AppState>,
) -> Result<(), SynapticError> {
    state.clear_inspector_messages(&server_name);
    Ok(())
}

// ============================================
// REGISTRY COMMANDS
// ============================================

/// Get list of available servers from registry
#[tauri::command]
pub async fn get_registry_servers() -> Result<Vec<RegistryServer>, SynapticError> {
    Ok(registry::get_builtin_registry())
}

/// Install a server from the registry
#[tauri::command]
pub async fn install_registry_server(
    server_id: String,
    custom_name: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), SynapticError> {
    let registry_server = registry::get_registry_server(&server_id)
        .ok_or_else(|| SynapticError::RegistryError(format!("Server not found: {}", server_id)))?;

    let name = custom_name.unwrap_or_else(|| registry_server.id.clone());

    // Add the server with default config
    state.add_server(name, registry_server.default_config)
}

/// Check if required runtime is available (node, python, etc.)
#[tauri::command]
pub async fn check_runtime(runtime: String) -> Result<RuntimeStatus, SynapticError> {
    registry::check_runtime_availability(&runtime).await
}

// ============================================
// PROCESS MANAGER COMMANDS
// ============================================

/// Spawn an MCP server process with MITM interception
#[tauri::command]
pub async fn spawn_server(
    name: String,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    pm: State<'_, crate::process_manager::ProcessManager>,
) -> Result<u32, SynapticError> {
    // Get server config
    let config = state.get_config()?;
    let server = config
        .mcp_servers
        .get(&name)
        .ok_or_else(|| SynapticError::ServerNotFound(name.clone()))?;

    // Spawn the process
    crate::process_manager::spawn_mcp_server(
        app,
        pm,
        name,
        server.command.clone(),
        server.args.clone(),
        server.env.clone(),
        server.cwd.clone(),
    )
    .await
}

/// Kill a running MCP server process
#[tauri::command]
pub async fn kill_server(
    name: String,
    pm: State<'_, crate::process_manager::ProcessManager>,
) -> Result<(), SynapticError> {
    pm.kill_process(&name).await
}

/// Send data to a running MCP server's stdin
#[tauri::command]
pub async fn send_to_server(
    name: String,
    payload: String,
    pm: State<'_, crate::process_manager::ProcessManager>,
) -> Result<(), SynapticError> {
    pm.send_to_stdin(&name, payload).await
}

/// Get list of currently running server processes
#[tauri::command]
pub async fn get_running_servers(
    pm: State<'_, crate::process_manager::ProcessManager>,
) -> Result<Vec<String>, SynapticError> {
    Ok(pm.list_running().await)
}
