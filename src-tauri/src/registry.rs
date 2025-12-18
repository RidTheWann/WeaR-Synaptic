//! Registry module for MCP server catalog and installation

use crate::config::McpServer;
use crate::error::{SynapticError, SynapticResult};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ============================================
// REGISTRY DATA MODELS
// ============================================

/// Server entry from the registry (for installation)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegistryServer {
    /// Unique identifier
    pub id: String,

    /// Human-readable name
    pub name: String,

    /// Description of functionality
    pub description: String,

    /// Icon URL or embedded base64
    pub icon: Option<String>,

    /// Installation method
    pub install_method: InstallMethod,

    /// Default configuration template
    pub default_config: McpServer,

    /// Repository URL for source
    pub repo_url: Option<String>,

    /// Tags for categorization
    pub tags: Vec<String>,
}

/// Installation method for registry servers
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum InstallMethod {
    /// Run via npx (Node.js)
    Npx { package: String },

    /// Run via uvx (Python/uv)
    Uvx { package: String },

    /// Clone from git repository
    GitClone {
        url: String,
        build_command: Option<String>,
    },

    /// Direct binary download
    Binary { url: String },
}

/// Runtime status check result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuntimeStatus {
    pub runtime: String,
    pub available: bool,
    pub version: Option<String>,
    pub path: Option<String>,
}

// ============================================
// BUILTIN REGISTRY
// ============================================

/// Get the hardcoded list of popular MCP servers
pub fn get_builtin_registry() -> Vec<RegistryServer> {
    vec![
        RegistryServer {
            id: "filesystem".into(),
            name: "Filesystem".into(),
            description: "Read/write access to local filesystem. Allows Claude to browse, read, and write files in specified directories.".into(),
            icon: None,
            install_method: InstallMethod::Npx {
                package: "@modelcontextprotocol/server-filesystem".into(),
            },
            default_config: McpServer {
                command: "npx".into(),
                args: vec![
                    "-y".into(),
                    "@modelcontextprotocol/server-filesystem".into(),
                    "C:\\Users".into(), // Placeholder path
                ],
                env: HashMap::new(),
                cwd: None,
                enabled: true,
            },
            repo_url: Some("https://github.com/modelcontextprotocol/servers".into()),
            tags: vec!["filesystem".into(), "official".into(), "core".into()],
        },
        RegistryServer {
            id: "sqlite".into(),
            name: "SQLite".into(),
            description: "Query and manage SQLite databases. Enables Claude to run SQL queries and explore database schemas.".into(),
            icon: None,
            install_method: InstallMethod::Uvx {
                package: "mcp-server-sqlite".into(),
            },
            default_config: McpServer {
                command: "uvx".into(),
                args: vec![
                    "mcp-server-sqlite".into(),
                    "--db-path".into(),
                    "database.db".into(),
                ],
                env: HashMap::new(),
                cwd: None,
                enabled: true,
            },
            repo_url: Some("https://github.com/modelcontextprotocol/servers".into()),
            tags: vec!["database".into(), "sql".into(), "official".into()],
        },
        RegistryServer {
            id: "github".into(),
            name: "GitHub".into(),
            description: "Interact with GitHub repositories. Create issues, PRs, search code, and manage repositories.".into(),
            icon: None,
            install_method: InstallMethod::Npx {
                package: "@modelcontextprotocol/server-github".into(),
            },
            default_config: McpServer {
                command: "npx".into(),
                args: vec![
                    "-y".into(),
                    "@modelcontextprotocol/server-github".into(),
                ],
                env: HashMap::from([("GITHUB_PERSONAL_ACCESS_TOKEN".into(), "".into())]),
                cwd: None,
                enabled: true,
            },
            repo_url: Some("https://github.com/modelcontextprotocol/servers".into()),
            tags: vec!["git".into(), "vcs".into(), "official".into()],
        },
        RegistryServer {
            id: "memory".into(),
            name: "Memory".into(),
            description: "Persistent memory and knowledge graph. Allows Claude to remember information across conversations.".into(),
            icon: None,
            install_method: InstallMethod::Npx {
                package: "@modelcontextprotocol/server-memory".into(),
            },
            default_config: McpServer {
                command: "npx".into(),
                args: vec![
                    "-y".into(),
                    "@modelcontextprotocol/server-memory".into(),
                ],
                env: HashMap::new(),
                cwd: None,
                enabled: true,
            },
            repo_url: Some("https://github.com/modelcontextprotocol/servers".into()),
            tags: vec!["memory".into(), "knowledge".into(), "official".into()],
        },
        RegistryServer {
            id: "brave-search".into(),
            name: "Brave Search".into(),
            description: "Web search powered by Brave. Search the web and get summarized results.".into(),
            icon: None,
            install_method: InstallMethod::Npx {
                package: "@modelcontextprotocol/server-brave-search".into(),
            },
            default_config: McpServer {
                command: "npx".into(),
                args: vec![
                    "-y".into(),
                    "@modelcontextprotocol/server-brave-search".into(),
                ],
                env: HashMap::from([("BRAVE_API_KEY".into(), "".into())]),
                cwd: None,
                enabled: true,
            },
            repo_url: Some("https://github.com/modelcontextprotocol/servers".into()),
            tags: vec!["search".into(), "web".into(), "official".into()],
        },
    ]
}

/// Get a registry server by ID
pub fn get_registry_server(id: &str) -> Option<RegistryServer> {
    get_builtin_registry().into_iter().find(|s| s.id == id)
}

// ============================================
// RUNTIME CHECKS
// ============================================

/// Check if a runtime (node, python, etc.) is available
pub async fn check_runtime_availability(runtime: &str) -> SynapticResult<RuntimeStatus> {
    let cmd = match runtime {
        "node" | "npx" => "node",
        "python" | "python3" | "uvx" | "uv" => "python",
        _ => {
            return Err(SynapticError::RuntimeNotFound(format!(
                "Unknown runtime: {}",
                runtime
            )))
        }
    };

    let version_arg = "--version";

    // Try to run the command
    let output = tokio::process::Command::new(cmd)
        .arg(version_arg)
        .output()
        .await;

    match output {
        Ok(output) if output.status.success() => {
            let version = String::from_utf8_lossy(&output.stdout)
                .trim()
                .to_string();

            Ok(RuntimeStatus {
                runtime: runtime.to_string(),
                available: true,
                version: Some(version),
                path: None, // Could use `which` to find the path
            })
        }
        _ => Ok(RuntimeStatus {
            runtime: runtime.to_string(),
            available: false,
            version: None,
            path: None,
        }),
    }
}
