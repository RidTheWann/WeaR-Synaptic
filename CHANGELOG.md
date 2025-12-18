# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and [Semantic Versioning](https://semver.org/).

## [1.0.0] - 2025-12-19

First stable release of WeaR-Synaptic - MCP Server Manager.

### Added

- Visual MCP server configuration management
- Registry browser for community servers
- Real-time JSON-RPC traffic inspector
- Process spawning with stdout/stderr capture
- SQLite persistence with WAL mode
- Session replay for debugging
- Automatic configuration backups

### Technical Details

- Frontend: React 19, TypeScript, TailwindCSS
- Backend: Rust, Tokio, Tauri 2.0
- Database: SQLite via tauri-plugin-sql
- Virtualized list rendering with react-virtuoso
