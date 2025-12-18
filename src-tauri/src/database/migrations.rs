//! Database schema migrations for Synaptic
//!
//! Migrations are applied automatically on app startup.
//! Each migration is versioned and runs in order.

use tauri_plugin_sql::{Migration, MigrationKind};

/// Get all database migrations
pub fn get_migrations() -> Vec<Migration> {
    vec![
        // V1: Initial schema - system_logs table
        Migration {
            version: 1,
            description: "Create system_logs table for persistent inspector logging",
            sql: r#"
                CREATE TABLE IF NOT EXISTS system_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT NOT NULL,
                    timestamp INTEGER NOT NULL,
                    level TEXT NOT NULL DEFAULT 'INFO',
                    category TEXT NOT NULL DEFAULT 'GENERAL',
                    message TEXT,
                    payload JSON,
                    trace_id TEXT,
                    server_name TEXT,
                    direction TEXT
                );
                
                -- Indexes for fast filtering
                CREATE INDEX IF NOT EXISTS idx_logs_session ON system_logs(session_id);
                CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON system_logs(timestamp);
                CREATE INDEX IF NOT EXISTS idx_logs_level ON system_logs(level);
                CREATE INDEX IF NOT EXISTS idx_logs_category ON system_logs(category);
                CREATE INDEX IF NOT EXISTS idx_logs_server ON system_logs(server_name);
            "#,
            kind: MigrationKind::Up,
        },
        // V2: Add sessions table for replay metadata
        Migration {
            version: 2,
            description: "Create sessions table for replay engine",
            sql: r#"
                CREATE TABLE IF NOT EXISTS sessions (
                    id TEXT PRIMARY KEY,
                    started_at INTEGER NOT NULL,
                    ended_at INTEGER,
                    server_name TEXT,
                    log_count INTEGER DEFAULT 0,
                    description TEXT
                );
                
                CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions(started_at);
            "#,
            kind: MigrationKind::Up,
        },
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_migrations_valid() {
        let migrations = get_migrations();
        assert!(!migrations.is_empty());

        // Ensure versions are sequential
        for (i, m) in migrations.iter().enumerate() {
            assert_eq!(m.version, (i + 1) as i64);
        }
    }
}
