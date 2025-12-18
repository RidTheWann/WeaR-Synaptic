//! Database module for SQLite persistence
//! Phase 5: Persistent logging with WAL mode

mod migrations;

pub use migrations::get_migrations;
