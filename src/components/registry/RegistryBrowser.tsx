import { useState } from "react";
import { Download, ExternalLink, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getRegistryServers, installRegistryServer } from "@/lib/tauri";
import type { RegistryServer } from "@/types";
import { useEffect } from "react";

interface RegistryBrowserProps {
    onInstall: () => void;
}

export function RegistryBrowser({ onInstall }: RegistryBrowserProps) {
    const [servers, setServers] = useState<RegistryServer[]>([]);
    const [loading, setLoading] = useState(true);
    const [installing, setInstalling] = useState<string | null>(null);
    const [installed, setInstalled] = useState<Set<string>>(new Set());

    useEffect(() => {
        loadRegistry();
    }, []);

    async function loadRegistry() {
        try {
            setLoading(true);
            const data = await getRegistryServers();
            setServers(data);
        } catch (err) {
            console.error("Failed to load registry:", err);
        } finally {
            setLoading(false);
        }
    }

    async function handleInstall(server: RegistryServer) {
        try {
            setInstalling(server.id);
            await installRegistryServer(server.id);
            setInstalled((prev) => new Set([...prev, server.id]));
            onInstall();
        } catch (err) {
            console.error("Failed to install server:", err);
        } finally {
            setInstalling(null);
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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {servers.map((server) => (
                <Card key={server.id} className="group hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                            <CardTitle className="text-lg">{server.name}</CardTitle>
                            {server.repoUrl && (
                                <a
                                    href={server.repoUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-muted-foreground hover:text-foreground"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                </a>
                            )}
                        </div>
                        <CardDescription className="line-clamp-2">
                            {server.description}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {/* Tags */}
                            <div className="flex flex-wrap gap-1">
                                {server.tags.map((tag) => (
                                    <Badge key={tag} variant="outline" className="text-xs">
                                        {tag}
                                    </Badge>
                                ))}
                            </div>

                            {/* Install Method */}
                            <div className="text-xs text-muted-foreground">
                                via{" "}
                                <span className="font-mono text-foreground">
                                    {server.installMethod.type === "npx"
                                        ? "npx"
                                        : server.installMethod.type === "uvx"
                                            ? "uvx"
                                            : server.installMethod.type}
                                </span>
                            </div>

                            {/* Install Button */}
                            <Button
                                className="w-full gap-2"
                                variant={installed.has(server.id) ? "secondary" : "default"}
                                disabled={installing === server.id || installed.has(server.id)}
                                onClick={() => handleInstall(server)}
                            >
                                {installed.has(server.id) ? (
                                    <>
                                        <Check className="w-4 h-4" />
                                        Installed
                                    </>
                                ) : installing === server.id ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                        Installing...
                                    </>
                                ) : (
                                    <>
                                        <Download className="w-4 h-4" />
                                        Install
                                    </>
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
