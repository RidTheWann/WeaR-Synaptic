//! Process Manager for MCP Server Lifecycle with MITM Inspection
//!
//! This module handles spawning MCP server processes, piping their stdin/stdout,
//! and emitting intercepted traffic to the frontend for inspection.

use crate::error::{SynapticError, SynapticResult};
use crate::inspector::InspectorMessage;
use futures::StreamExt;
use std::collections::HashMap;
use std::process::Stdio;
use tauri::{AppHandle, Emitter, Manager};
use tokio::io::AsyncWriteExt;
use tokio::process::{Child, Command};
use tokio::sync::mpsc::{self, Receiver, Sender};
use tokio::sync::Mutex;
use tokio_util::codec::{FramedRead, LinesCodec};

// ============================================
// DATA STRUCTURES
// ============================================

/// Represents an active MCP server process
pub struct ActiveProcess {
    /// Server name identifier
    pub server_name: String,
    /// Channel to send data to the process stdin
    pub stdin_tx: Sender<String>,
    /// Channel to signal process termination
    pub kill_tx: Sender<()>,
    /// OS process ID
    pub pid: u32,
}

/// Traffic event emitted to the frontend
#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct McpTrafficEvent {
    pub server_id: String,
    pub timestamp: String,
    pub direction: String,
    pub content: String,
    pub message_id: String,
}

/// Process manager state
pub struct ProcessManager {
    /// Currently active processes
    pub processes: Mutex<HashMap<String, ActiveProcess>>,
    /// Secret values to redact from logs
    pub secrets: Mutex<Vec<String>>,
}

impl ProcessManager {
    pub fn new() -> Self {
        Self {
            processes: Mutex::new(HashMap::new()),
            secrets: Mutex::new(Vec::new()),
        }
    }

    /// Register secret values that should be redacted from logs
    pub async fn register_secrets(&self, secrets: Vec<String>) {
        let mut current = self.secrets.lock().await;
        for secret in secrets {
            if !secret.is_empty() && !current.contains(&secret) {
                current.push(secret);
            }
        }
    }

    /// Redact secrets from a string
    async fn redact_secrets(&self, content: &str) -> String {
        let secrets = self.secrets.lock().await;
        let mut result = content.to_string();
        for secret in secrets.iter() {
            if !secret.is_empty() {
                result = result.replace(secret, "[REDACTED]");
            }
        }
        result
    }

    /// Check if a process is running
    pub async fn is_running(&self, server_name: &str) -> bool {
        let processes = self.processes.lock().await;
        processes.contains_key(server_name)
    }

    /// Kill a specific process
    pub async fn kill_process(&self, server_name: &str) -> SynapticResult<()> {
        let mut processes = self.processes.lock().await;

        if let Some(process) = processes.remove(server_name) {
            // Send kill signal
            let _ = process.kill_tx.send(()).await;
            Ok(())
        } else {
            Err(SynapticError::ProcessError(format!(
                "Process not found: {}",
                server_name
            )))
        }
    }

    /// Kill all running processes
    pub async fn kill_all(&self) {
        let mut processes = self.processes.lock().await;
        for (_, process) in processes.drain() {
            let _ = process.kill_tx.send(()).await;
        }
    }

    /// Send data to a process stdin
    pub async fn send_to_stdin(&self, server_name: &str, data: String) -> SynapticResult<()> {
        let processes = self.processes.lock().await;

        if let Some(process) = processes.get(server_name) {
            process
                .stdin_tx
                .send(data)
                .await
                .map_err(|e| SynapticError::ProcessError(format!("Failed to send: {}", e)))?;
            Ok(())
        } else {
            Err(SynapticError::ProcessError(format!(
                "Process not found: {}",
                server_name
            )))
        }
    }

    /// Get list of running process names
    pub async fn list_running(&self) -> Vec<String> {
        let processes = self.processes.lock().await;
        processes.keys().cloned().collect()
    }
}

impl Default for ProcessManager {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================
// WHITELISTED EXECUTABLES
// ============================================

/// List of allowed executable commands
const ALLOWED_EXECUTABLES: &[&str] = &[
    "npx", "node", "npm", "uvx", "uv", "python", "python3", "pip", "pip3", "docker", "deno", "bun",
];

/// Check if a command is in the whitelist
pub fn is_command_allowed(command: &str) -> bool {
    let cmd_lower = command.to_lowercase();
    let cmd_base = cmd_lower
        .split(['/', '\\'])
        .last()
        .unwrap_or(&cmd_lower)
        .trim_end_matches(".exe")
        .trim_end_matches(".cmd")
        .trim_end_matches(".bat");

    ALLOWED_EXECUTABLES.contains(&cmd_base)
}

// ============================================
// PROCESS SPAWNING
// ============================================

/// Spawn an MCP server process with MITM interception
pub async fn spawn_mcp_server(
    app: AppHandle,
    process_manager: tauri::State<'_, ProcessManager>,
    server_name: String,
    command: String,
    args: Vec<String>,
    env: HashMap<String, String>,
    cwd: Option<String>,
) -> SynapticResult<u32> {
    // Validate command is whitelisted
    if !is_command_allowed(&command) {
        return Err(SynapticError::ProcessError(format!(
            "Command not allowed: {}. Allowed: {:?}",
            command, ALLOWED_EXECUTABLES
        )));
    }

    // Check if already running
    if process_manager.is_running(&server_name).await {
        return Err(SynapticError::ProcessError(format!(
            "Server already running: {}",
            server_name
        )));
    }

    // Register environment variable values as secrets
    let secrets: Vec<String> = env.values().cloned().collect();
    process_manager.register_secrets(secrets).await;

    // Build the command
    let mut cmd = Command::new(&command);
    cmd.args(&args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);

    // Set environment variables
    for (key, value) in &env {
        cmd.env(key, value);
    }

    // Set working directory if provided
    if let Some(ref dir) = cwd {
        cmd.current_dir(dir);
    }

    // Spawn the process
    let mut child: Child = cmd
        .spawn()
        .map_err(|e| SynapticError::ProcessError(format!("Failed to spawn: {}", e)))?;

    let pid = child
        .id()
        .ok_or_else(|| SynapticError::ProcessError("Failed to get PID".to_string()))?;

    // Take ownership of stdio handles
    let stdin = child.stdin.take().expect("Failed to capture stdin");
    let stdout = child.stdout.take().expect("Failed to capture stdout");
    let stderr = child.stderr.take().expect("Failed to capture stderr");

    // Create channels
    let (stdin_tx, stdin_rx): (Sender<String>, Receiver<String>) = mpsc::channel(100);
    let (kill_tx, mut kill_rx): (Sender<()>, Receiver<()>) = mpsc::channel(1);

    // Clone app handle for all tasks (AppHandle is Clone)
    let app_stdin = app.clone();
    let app_stdout = app.clone();
    let app_stderr = app.clone();
    let app_watchdog = app.clone();

    // Clone server name for each task
    let server_name_stdin = server_name.clone();
    let server_name_stdout = server_name.clone();
    let server_name_stderr = server_name.clone();
    let server_name_watchdog = server_name.clone();

    // Get secrets list for redaction (copy current secrets)
    let secrets_for_stdin = process_manager.secrets.lock().await.clone();
    let secrets_for_stdout = secrets_for_stdin.clone();

    // Spawn stdin writer task
    let stdin_handle = tokio::spawn(async move {
        let mut stdin = stdin;
        let mut rx = stdin_rx;
        let secrets = secrets_for_stdin;

        while let Some(data) = rx.recv().await {
            // Redact secrets
            let mut redacted = data.clone();
            for secret in &secrets {
                if !secret.is_empty() {
                    redacted = redacted.replace(secret, "[REDACTED]");
                }
            }

            // Emit outgoing traffic event
            let event = McpTrafficEvent {
                server_id: server_name_stdin.clone(),
                timestamp: chrono::Utc::now().to_rfc3339(),
                direction: "OUTGOING".to_string(),
                content: redacted,
                message_id: uuid::Uuid::new_v4().to_string(),
            };
            let _ = app_stdin.emit("mcp-traffic", event);

            // Write to stdin
            if let Err(e) = stdin.write_all(data.as_bytes()).await {
                eprintln!("Error writing to stdin: {}", e);
                break;
            }
            if let Err(e) = stdin.write_all(b"\n").await {
                eprintln!("Error writing newline: {}", e);
                break;
            }
            if let Err(e) = stdin.flush().await {
                eprintln!("Error flushing stdin: {}", e);
                break;
            }
        }
    });

    // Spawn stdout reader task
    let stdout_handle = tokio::spawn(async move {
        let mut reader = FramedRead::new(stdout, LinesCodec::new());
        let secrets = secrets_for_stdout;

        while let Some(line_result) = reader.next().await {
            match line_result {
                Ok(line) => {
                    // Redact secrets
                    let mut redacted = line.clone();
                    for secret in &secrets {
                        if !secret.is_empty() {
                            redacted = redacted.replace(secret, "[REDACTED]");
                        }
                    }

                    let event = McpTrafficEvent {
                        server_id: server_name_stdout.clone(),
                        timestamp: chrono::Utc::now().to_rfc3339(),
                        direction: "INCOMING".to_string(),
                        content: redacted,
                        message_id: uuid::Uuid::new_v4().to_string(),
                    };
                    let _ = app_stdout.emit("mcp-traffic", event);

                    // Also store in inspector state if available
                    if let Some(state) = app_stdout.try_state::<crate::state::AppState>() {
                        if let Ok(payload) = serde_json::from_str(&line) {
                            let msg = InspectorMessage::new_response(&server_name_stdout, payload);
                            state.add_inspector_message(&server_name_stdout, msg);
                        }
                    }
                }
                Err(e) => {
                    eprintln!("Error reading stdout from {}: {}", server_name_stdout, e);
                    break;
                }
            }
        }
    });

    // Spawn stderr reader task (for debugging)
    let stderr_handle = tokio::spawn(async move {
        let mut reader = FramedRead::new(stderr, LinesCodec::new());

        while let Some(line_result) = reader.next().await {
            match line_result {
                Ok(line) => {
                    let event = McpTrafficEvent {
                        server_id: server_name_stderr.clone(),
                        timestamp: chrono::Utc::now().to_rfc3339(),
                        direction: "STDERR".to_string(),
                        content: line,
                        message_id: uuid::Uuid::new_v4().to_string(),
                    };
                    let _ = app_stderr.emit("mcp-traffic", event);
                }
                Err(e) => {
                    eprintln!("Error reading stderr: {}", e);
                    break;
                }
            }
        }
    });

    // Spawn process watchdog task
    tokio::spawn(async move {
        tokio::select! {
            // Wait for kill signal
            _ = kill_rx.recv() => {
                // Kill the child process
                let _ = child.kill().await;
            }
            // Wait for process to exit naturally
            status = child.wait() => {
                eprintln!("Process {} exited with status: {:?}", server_name_watchdog, status);
            }
        }

        // Cleanup
        stdin_handle.abort();
        stdout_handle.abort();
        stderr_handle.abort();

        // Remove from process manager
        if let Some(pm) = app_watchdog.try_state::<ProcessManager>() {
            let mut processes = pm.processes.lock().await;
            processes.remove(&server_name_watchdog);
        }

        // Emit process stopped event
        let _ = app_watchdog.emit("process-stopped", &server_name_watchdog);
    });

    // Store the process
    {
        let mut processes = process_manager.processes.lock().await;
        processes.insert(
            server_name.clone(),
            ActiveProcess {
                server_name: server_name.clone(),
                stdin_tx,
                kill_tx,
                pid,
            },
        );
    }

    Ok(pid)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_command_whitelist() {
        assert!(is_command_allowed("npx"));
        assert!(is_command_allowed("node"));
        assert!(is_command_allowed("python"));
        assert!(is_command_allowed("uvx"));
        assert!(is_command_allowed("docker"));

        // With path
        assert!(is_command_allowed("/usr/bin/node"));
        assert!(is_command_allowed("C:\\Program Files\\node"));

        // With extension
        assert!(is_command_allowed("node.exe"));
        assert!(is_command_allowed("npx.cmd"));

        // Not allowed
        assert!(!is_command_allowed("bash"));
        assert!(!is_command_allowed("sh"));
        assert!(!is_command_allowed("cmd"));
        assert!(!is_command_allowed("powershell"));
        assert!(!is_command_allowed("rm"));
    }
}
