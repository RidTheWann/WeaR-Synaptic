//! Inspector module for capturing MCP server JSON-RPC traffic

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ============================================
// INSPECTOR DATA MODELS
// ============================================

/// Direction of JSON-RPC message
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum MessageDirection {
    /// Client -> Server (request)
    Request,
    /// Server -> Client (response)
    Response,
}

/// Captured JSON-RPC message for the inspector
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InspectorMessage {
    /// Unique message ID
    pub id: String,

    /// Timestamp of capture
    pub timestamp: DateTime<Utc>,

    /// Direction of message flow
    pub direction: MessageDirection,

    /// Server name this message belongs to
    pub server_name: String,

    /// Raw JSON-RPC payload
    pub payload: serde_json::Value,

    /// Parsed method name (if request)
    pub method: Option<String>,

    /// Duration in milliseconds (for responses matched to requests)
    pub duration_ms: Option<u64>,
}

impl InspectorMessage {
    /// Create a new request message
    pub fn new_request(server_name: &str, payload: serde_json::Value) -> Self {
        let method = payload.get("method").and_then(|m| m.as_str()).map(String::from);

        Self {
            id: Uuid::new_v4().to_string(),
            timestamp: Utc::now(),
            direction: MessageDirection::Request,
            server_name: server_name.to_string(),
            payload,
            method,
            duration_ms: None,
        }
    }

    /// Create a new response message
    pub fn new_response(server_name: &str, payload: serde_json::Value) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            timestamp: Utc::now(),
            direction: MessageDirection::Response,
            server_name: server_name.to_string(),
            payload,
            method: None,
            duration_ms: None,
        }
    }
}

/// Inspector session state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InspectorSession {
    pub server_name: String,
    pub started_at: DateTime<Utc>,
    pub is_active: bool,
    pub message_count: usize,
}

impl InspectorSession {
    pub fn new(server_name: &str) -> Self {
        Self {
            server_name: server_name.to_string(),
            started_at: Utc::now(),
            is_active: true,
            message_count: 0,
        }
    }
}

// ============================================
// INSPECTOR PROXY (PLACEHOLDER)
// ============================================

// Note: Full MITM proxy implementation requires more complex
// process spawning and stdio piping. This is a placeholder
// for the MVP that captures messages from the frontend.

/// Parse a JSON-RPC message and determine its type
pub fn parse_jsonrpc_message(raw: &str) -> Option<(MessageDirection, serde_json::Value)> {
    let value: serde_json::Value = serde_json::from_str(raw).ok()?;

    // If it has a "method" field, it's a request
    if value.get("method").is_some() {
        Some((MessageDirection::Request, value))
    // If it has a "result" or "error" field, it's a response
    } else if value.get("result").is_some() || value.get("error").is_some() {
        Some((MessageDirection::Response, value))
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_request() {
        let json = r#"{"jsonrpc":"2.0","method":"tools/list","id":1}"#;
        let result = parse_jsonrpc_message(json);
        assert!(result.is_some());
        let (direction, _) = result.unwrap();
        assert_eq!(direction, MessageDirection::Request);
    }

    #[test]
    fn test_parse_response() {
        let json = r#"{"jsonrpc":"2.0","result":{"tools":[]},"id":1}"#;
        let result = parse_jsonrpc_message(json);
        assert!(result.is_some());
        let (direction, _) = result.unwrap();
        assert_eq!(direction, MessageDirection::Response);
    }
}
