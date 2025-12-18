# WeaR-Synaptic

A cross-platform desktop application for managing Model Context Protocol (MCP) servers. Built with Tauri 2.0 and Rust.

## Overview

Synaptic provides a visual interface for configuring MCP servers used by Claude Desktop and other LLM applications. It includes traffic inspection, process management, and persistent logging capabilities.

## Features

### Server Management
- Add, edit, and remove MCP server configurations
- Toggle servers on/off without editing JSON files
- Browse community MCP servers from the registry

### Traffic Inspector
- Intercept JSON-RPC communication between clients and servers
- View request/response payloads in real-time
- Replay captured requests for debugging

### Data Persistence
- SQLite database with Write-Ahead Logging (WAL)
- Automatic configuration backups
- Session recording for historical analysis

## Requirements

| Platform | Minimum Version | Dependencies |
|----------|-----------------|--------------|
| Windows | 10 (Build 19041+) | WebView2 Runtime |
| macOS | 10.15 Catalina | None |
| Linux | Ubuntu 20.04 | libwebkit2gtk-4.1-0, libgtk-3-0 |

## Installation

Download the installer from the [Releases](https://github.com/RidTheWann/WeaR-Synaptic/releases) page.

## Building from Source

### Prerequisites

- Rust 1.75 or later
- Node.js 20 LTS or later
- npm or pnpm

### Build Steps

```bash
git clone https://github.com/RidTheWann/WeaR-Synaptic.git
cd WeaR-Synaptic

npm install
npm run tauri dev      # Development mode
npm run tauri build    # Production build
```

Output binaries are located in `src-tauri/target/release/bundle/`.

## Project Structure

```
src/                    # React frontend
  components/           # UI components
  services/             # Database and API services
  stores/               # State management
src-tauri/              # Rust backend
  src/
    config.rs           # Configuration management
    process_manager.rs  # MCP server process handling
    database/           # SQLite migrations
```

## Configuration

Synaptic manages the Claude Desktop configuration file:

- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

## Security

- Executable whitelist prevents arbitrary command execution
- Environment variable values are redacted from logs
- All database queries use parameterized statements

## License

MIT License - see [LICENSE](LICENSE) for details.

---

Created by Muhammad Ridwan Saputra ([RidTheWann](https://github.com/RidTheWann))
