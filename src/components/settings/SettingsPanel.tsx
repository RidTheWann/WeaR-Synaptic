/**
 * Settings Panel with Backup Management
 * Provides configuration overview, backup/restore, and dangerous actions
 */

import { useState, useEffect } from "react";
import {
    Settings,
    FolderOpen,
    Download,
    Upload,
    Trash2,
    Clock,
    AlertTriangle,
    FileJson,
    RotateCcw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getConfigPath, listBackups, restoreBackup, readConfig } from "@/lib/tauri";
import type { BackupInfo } from "@/types";
import { cn } from "@/lib/utils";

export function SettingsPanel() {
    const [configPath, setConfigPath] = useState<string>("");
    const [backups, setBackups] = useState<BackupInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [serverCount, setServerCount] = useState(0);

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        setLoading(true);
        try {
            const [path, backupList, config] = await Promise.all([
                getConfigPath(),
                listBackups(),
                readConfig(),
            ]);
            setConfigPath(path);
            setBackups(backupList);
            setServerCount(Object.keys(config.mcpServers || {}).length);
        } catch (err) {
            console.error("Failed to load settings data:", err);
        } finally {
            setLoading(false);
        }
    }

    async function handleRestore(backupId: string) {
        if (!confirm(`Are you sure you want to restore this backup? This will overwrite your current configuration.`)) {
            return;
        }

        try {
            await restoreBackup(backupId);
            alert("Backup restored successfully. Please restart the application.");
            await loadData();
        } catch (err) {
            console.error("Failed to restore backup:", err);
            alert(`Failed to restore: ${err}`);
        }
    }

    async function handleExport() {
        try {
            const config = await readConfig();
            const dataStr = JSON.stringify(config, null, 2);
            const blob = new Blob([dataStr], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `synaptic-config-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error("Failed to export:", err);
            alert(`Failed to export: ${err}`);
        }
    }

    function formatBytes(bytes: number): string {
        if (bytes === 0) return "0 B";
        const k = 1024;
        const sizes = ["B", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
    }

    function formatDate(dateStr: string): string {
        try {
            return new Date(dateStr).toLocaleString();
        } catch {
            return dateStr;
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Settings className="w-5 h-5 text-primary" />
                </div>
                <div>
                    <h1 className="text-xl font-semibold">Settings</h1>
                    <p className="text-sm text-muted-foreground">
                        Manage configuration and backups
                    </p>
                </div>
            </div>

            <Tabs defaultValue="general" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="general">General</TabsTrigger>
                    <TabsTrigger value="backups">Backups</TabsTrigger>
                    <TabsTrigger value="danger">Danger Zone</TabsTrigger>
                </TabsList>

                {/* General Tab */}
                <TabsContent value="general" className="space-y-4">
                    {/* Config Info Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <FileJson className="w-4 h-4" />
                                Configuration
                            </CardTitle>
                            <CardDescription>
                                Claude Desktop MCP configuration file location
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md">
                                <FolderOpen className="w-4 h-4 text-muted-foreground" />
                                <code className="text-xs flex-1 break-all">{configPath}</code>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <Badge variant="secondary">{serverCount}</Badge>
                                    <span className="text-sm text-muted-foreground">
                                        Servers configured
                                    </span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Export Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Download className="w-4 h-4" />
                                Export Configuration
                            </CardTitle>
                            <CardDescription>
                                Download your configuration as a JSON file
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button onClick={handleExport} variant="outline">
                                <Download className="w-4 h-4 mr-2" />
                                Export to JSON
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Backups Tab */}
                <TabsContent value="backups" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Clock className="w-4 h-4" />
                                Configuration Backups
                            </CardTitle>
                            <CardDescription>
                                Backups are created automatically before each change
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {backups.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">No backups yet</p>
                                    <p className="text-xs mt-1">
                                        Backups will appear here after you make configuration changes
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {backups.map((backup) => (
                                        <div
                                            key={backup.id}
                                            className="flex items-center justify-between p-3 border rounded-md hover:bg-accent/50 transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                                                    <FileJson className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium">
                                                        {backup.filename}
                                                    </p>
                                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                        <span>{formatDate(backup.createdAt)}</span>
                                                        <span>•</span>
                                                        <span>{formatBytes(backup.sizeBytes)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleRestore(backup.id)}
                                            >
                                                <RotateCcw className="w-4 h-4 mr-1" />
                                                Restore
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Danger Zone Tab */}
                <TabsContent value="danger" className="space-y-4">
                    <Card className="border-destructive/50">
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2 text-destructive">
                                <AlertTriangle className="w-4 h-4" />
                                Danger Zone
                            </CardTitle>
                            <CardDescription>
                                These actions are irreversible. Please proceed with caution.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between p-4 border border-destructive/30 rounded-md">
                                <div>
                                    <p className="font-medium">Clear All Inspector Logs</p>
                                    <p className="text-sm text-muted-foreground">
                                        Remove all captured traffic data from memory
                                    </p>
                                </div>
                                <Button
                                    variant="outline"
                                    className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                                    onClick={() => {
                                        if (confirm("Are you sure you want to clear all inspector logs?")) {
                                            alert("Logs cleared. Restart the application to fully reset.");
                                        }
                                    }}
                                >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Clear Logs
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
