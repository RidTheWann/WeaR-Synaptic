/**
 * Tauri command wrappers for type-safe IPC calls
 */

import { invoke } from "@tauri-apps/api/core";
import type {
    McpConfig,
    McpServer,
    BackupInfo,
    InspectorMessage,
    InspectorSession,
    RegistryServer,
    RuntimeStatus,
} from "../types";

// ============================================
// CONFIG MANAGER COMMANDS
// ============================================

export async function getConfigPath(): Promise<string> {
    return invoke<string>("get_config_path");
}

export async function readConfig(): Promise<McpConfig> {
    return invoke<McpConfig>("read_config");
}

export async function writeConfig(config: McpConfig): Promise<void> {
    return invoke<void>("write_config", { config });
}

export async function addServer(name: string, server: McpServer): Promise<void> {
    return invoke<void>("add_server", { name, server });
}

export async function removeServer(name: string): Promise<void> {
    return invoke<void>("remove_server", { name });
}

export async function updateServer(name: string, server: McpServer): Promise<void> {
    return invoke<void>("update_server", { name, server });
}

export async function toggleServer(name: string, enabled: boolean): Promise<void> {
    return invoke<void>("toggle_server", { name, enabled });
}

export async function listBackups(): Promise<BackupInfo[]> {
    return invoke<BackupInfo[]>("list_backups");
}

export async function restoreBackup(backupId: string): Promise<void> {
    return invoke<void>("restore_backup", { backupId });
}

// ============================================
// INSPECTOR COMMANDS
// ============================================

export async function startInspector(serverName: string): Promise<InspectorSession> {
    return invoke<InspectorSession>("start_inspector", { serverName });
}

export async function stopInspector(serverName: string): Promise<void> {
    return invoke<void>("stop_inspector", { serverName });
}

export async function getInspectorMessages(
    serverName: string,
    limit?: number,
    offset?: number
): Promise<InspectorMessage[]> {
    return invoke<InspectorMessage[]>("get_inspector_messages", {
        serverName,
        limit,
        offset,
    });
}

export async function clearInspectorMessages(serverName: string): Promise<void> {
    return invoke<void>("clear_inspector_messages", { serverName });
}

// ============================================
// REGISTRY COMMANDS
// ============================================

export async function getRegistryServers(): Promise<RegistryServer[]> {
    return invoke<RegistryServer[]>("get_registry_servers");
}

export async function installRegistryServer(
    serverId: string,
    customName?: string
): Promise<void> {
    return invoke<void>("install_registry_server", { serverId, customName });
}

export async function checkRuntime(runtime: string): Promise<RuntimeStatus> {
    return invoke<RuntimeStatus>("check_runtime", { runtime });
}

// ============================================
// PROCESS MANAGER COMMANDS
// ============================================

export async function spawnServer(name: string): Promise<number> {
    return invoke<number>("spawn_server", { name });
}

export async function killServer(name: string): Promise<void> {
    return invoke<void>("kill_server", { name });
}

export async function sendToServer(name: string, payload: string): Promise<void> {
    return invoke<void>("send_to_server", { name, payload });
}

export async function getRunningServers(): Promise<string[]> {
    return invoke<string[]>("get_running_servers");
}

