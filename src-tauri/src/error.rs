//! Custom error types for Synaptic backend operations

use serde::Serialize;
use thiserror::Error;

/// Application-wide error type
#[derive(Debug, Error)]
pub enum SynapticError {
    #[error("Configuration file not found: {0}")]
    ConfigNotFound(String),

    #[error("Failed to read configuration: {0}")]
    ConfigReadError(String),

    #[error("Failed to write configuration: {0}")]
    ConfigWriteError(String),

    #[error("Failed to parse configuration: {0}")]
    ConfigParseError(String),

    #[error("Server not found: {0}")]
    ServerNotFound(String),

    #[error("Server already exists: {0}")]
    ServerAlreadyExists(String),

    #[error("Backup operation failed: {0}")]
    BackupError(String),

    #[error("Inspector error: {0}")]
    InspectorError(String),

    #[error("Registry error: {0}")]
    RegistryError(String),

    #[error("Runtime not found: {0}")]
    RuntimeNotFound(String),

    #[error("IO error: {0}")]
    IoError(String),

    #[error("Process error: {0}")]
    ProcessError(String),
}

/// Serializable error response for frontend
#[derive(Debug, Clone, Serialize)]
pub struct ErrorResponse {
    pub code: String,
    pub message: String,
}

impl From<SynapticError> for ErrorResponse {
    fn from(err: SynapticError) -> Self {
        let code = match &err {
            SynapticError::ConfigNotFound(_) => "CONFIG_NOT_FOUND",
            SynapticError::ConfigReadError(_) => "CONFIG_READ_ERROR",
            SynapticError::ConfigWriteError(_) => "CONFIG_WRITE_ERROR",
            SynapticError::ConfigParseError(_) => "CONFIG_PARSE_ERROR",
            SynapticError::ServerNotFound(_) => "SERVER_NOT_FOUND",
            SynapticError::ServerAlreadyExists(_) => "SERVER_ALREADY_EXISTS",
            SynapticError::BackupError(_) => "BACKUP_ERROR",
            SynapticError::InspectorError(_) => "INSPECTOR_ERROR",
            SynapticError::RegistryError(_) => "REGISTRY_ERROR",
            SynapticError::RuntimeNotFound(_) => "RUNTIME_NOT_FOUND",
            SynapticError::IoError(_) => "IO_ERROR",
            SynapticError::ProcessError(_) => "PROCESS_ERROR",
        };

        ErrorResponse {
            code: code.to_string(),
            message: err.to_string(),
        }
    }
}

// Make SynapticError serializable for Tauri IPC
impl Serialize for SynapticError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        ErrorResponse::from(self.clone_as_error()).serialize(serializer)
    }
}

impl SynapticError {
    fn clone_as_error(&self) -> Self {
        match self {
            Self::ConfigNotFound(s) => Self::ConfigNotFound(s.clone()),
            Self::ConfigReadError(s) => Self::ConfigReadError(s.clone()),
            Self::ConfigWriteError(s) => Self::ConfigWriteError(s.clone()),
            Self::ConfigParseError(s) => Self::ConfigParseError(s.clone()),
            Self::ServerNotFound(s) => Self::ServerNotFound(s.clone()),
            Self::ServerAlreadyExists(s) => Self::ServerAlreadyExists(s.clone()),
            Self::BackupError(s) => Self::BackupError(s.clone()),
            Self::InspectorError(s) => Self::InspectorError(s.clone()),
            Self::RegistryError(s) => Self::RegistryError(s.clone()),
            Self::RuntimeNotFound(s) => Self::RuntimeNotFound(s.clone()),
            Self::IoError(s) => Self::IoError(s.clone()),
            Self::ProcessError(s) => Self::ProcessError(s.clone()),
        }
    }
}

impl From<std::io::Error> for SynapticError {
    fn from(err: std::io::Error) -> Self {
        SynapticError::IoError(err.to_string())
    }
}

impl From<serde_json::Error> for SynapticError {
    fn from(err: serde_json::Error) -> Self {
        SynapticError::ConfigParseError(err.to_string())
    }
}

/// Result type alias for Synaptic operations
pub type SynapticResult<T> = Result<T, SynapticError>;
