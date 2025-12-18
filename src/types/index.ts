/**
 * TypeScript interfaces for WeaR-Synaptic
 * These mirror the Rust structs for type-safe IPC
 */

// ============================================
// MCP CONFIGURATION TYPES
// ============================================

export interface McpConfig {
    mcpServers: Record<string, McpServer>;
}

export interface McpServer {
    command: string;
    args: string[];
    env: Record<string, string>;
    cwd?: string;
    enabled: boolean;
}

// Form-specific types
export type TransportType = "stdio" | "sse";

export interface ServerFormData {
    name: string;
    transport: TransportType;
    command?: string;
    args: { value: string }[];
    env: { key: string; value: string }[];
    url?: string;
}

// ============================================
// BACKUP TYPES
// ============================================

export interface BackupInfo {
    id: string;
    filename: string;
    createdAt: string;
    sizeBytes: number;
}

// ============================================
// INSPECTOR TYPES
// ============================================

export type MessageDirection = "request" | "response";

export interface InspectorMessage {
    id: string;
    timestamp: string;
    direction: MessageDirection;
    serverName: string;
    payload: unknown;
    method?: string;
    durationMs?: number;
}

export interface InspectorSession {
    serverName: string;
    startedAt: string;
    isActive: boolean;
    messageCount: number;
}

// ============================================
// REGISTRY TYPES
// ============================================

export interface RegistryServer {
    id: string;
    name: string;
    description: string;
    icon?: string;
    installMethod: InstallMethod;
    defaultConfig: McpServer;
    repoUrl?: string;
    tags: string[];
}

export type InstallMethod =
    | { type: "npx"; package: string }
    | { type: "uvx"; package: string }
    | { type: "git_clone"; url: string; buildCommand?: string }
    | { type: "binary"; url: string };

export interface RuntimeStatus {
    runtime: string;
    available: boolean;
    version?: string;
    path?: string;
}

// ============================================
// UI STATE TYPES
// ============================================

export type ActiveView = "servers" | "inspector" | "registry" | "settings";
