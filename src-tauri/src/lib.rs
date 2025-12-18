//! Synaptic - MCP Server Manager
//!
//! Core library implementing the Tauri application with mobile-first pattern.
//! This is the CORE module following Tauri v2 C1 constraint.

// Module declarations
mod commands;
mod config;
mod database;
mod error;
mod inspector;
mod process_manager;
mod registry;
mod state;

// Re-exports for external use
pub use config::{McpConfig, McpServer};
pub use error::{SynapticError, SynapticResult};
pub use inspector::{InspectorMessage, InspectorSession, MessageDirection};
pub use process_manager::ProcessManager;
pub use registry::{InstallMethod, RegistryServer, RuntimeStatus};
pub use state::AppState;

// Import Manager trait for app.manage() method
use tauri::Manager;

/// Mobile entry point annotation for iOS/Android compatibility
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Get database migrations
    let migrations = database::get_migrations();

    tauri::Builder::default()
        // Initialize plugins
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        // SQL plugin with migrations for persistent logging
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:wear-synaptic.db", migrations)
                .build(),
        )
        // Set up managed state
        .setup(|app| {
            // Initialize application state
            app.manage(AppState::new());
            // Initialize process manager
            app.manage(ProcessManager::new());
            Ok(())
        })
        // Register IPC command handlers
        .invoke_handler(tauri::generate_handler![
            // Config Manager Commands
            commands::get_config_path,
            commands::read_config,
            commands::write_config,
            commands::add_server,
            commands::remove_server,
            commands::update_server,
            commands::toggle_server,
            commands::list_backups,
            commands::restore_backup,
            // Inspector Commands
            commands::start_inspector,
            commands::stop_inspector,
            commands::get_inspector_messages,
            commands::clear_inspector_messages,
            // Process Manager Commands
            commands::spawn_server,
            commands::kill_server,
            commands::send_to_server,
            commands::get_running_servers,
            // Registry Commands
            commands::get_registry_servers,
            commands::install_registry_server,
            commands::check_runtime,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Synaptic application");
}
