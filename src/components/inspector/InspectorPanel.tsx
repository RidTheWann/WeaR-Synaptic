/**
 * Enhanced Inspector Panel with real-time MITM traffic display
 * Subscribes to Tauri events for live traffic updates
 */

import { useState, useEffect, useCallback } from "react";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import {
    Play,
    Square,
    Trash2,
    ArrowUp,
    ArrowDown,
    AlertCircle,
    Zap,
    RotateCcw,
    Filter,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAppStore } from "@/stores/appStore";
import {
    startInspector,
    stopInspector,
    clearInspectorMessages,
    spawnServer,
    killServer,
    sendToServer,
    getRunningServers,
} from "@/lib/tauri";
import { cn } from "@/lib/utils";

// Traffic event from backend
interface McpTrafficEvent {
    serverId: string;
    timestamp: string;
    direction: "INCOMING" | "OUTGOING" | "STDERR";
    content: string;
    messageId: string;
}

// Internal message format
interface TrafficMessage {
    id: string;
    timestamp: string;
    direction: "INCOMING" | "OUTGOING" | "STDERR";
    content: string;
    method?: string;
}

type DirectionFilter = "all" | "incoming" | "outgoing";

export function InspectorPanel() {
    const { selectedServer, inspectorActive, setInspectorActive } = useAppStore();
    const [messages, setMessages] = useState<TrafficMessage[]>([]);
    const [selectedMessage, setSelectedMessage] = useState<TrafficMessage | null>(null);
    const [isProcessRunning, setIsProcessRunning] = useState(false);
    const [filter, setFilter] = useState<DirectionFilter>("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [stdinInput, setStdinInput] = useState("");

    // Check if process is running on mount and when server changes
    useEffect(() => {
        if (selectedServer) {
            checkProcessStatus();
        }
    }, [selectedServer]);

    async function checkProcessStatus() {
        try {
            const running = await getRunningServers();
            setIsProcessRunning(running.includes(selectedServer || ""));
        } catch (err) {
            console.error("Failed to check process status:", err);
        }
    }

    // Subscribe to real-time traffic events
    useEffect(() => {
        let unlisten: UnlistenFn | null = null;

        async function setupListener() {
            unlisten = await listen<McpTrafficEvent>("mcp-traffic", (event) => {
                const traffic = event.payload;

                // Only add messages for the selected server
                if (traffic.serverId !== selectedServer) return;

                // Parse method from content if it's a JSON-RPC request
                let method: string | undefined;
                try {
                    const parsed = JSON.parse(traffic.content);
                    method = parsed.method;
                } catch {
                    // Not JSON, that's fine
                }

                const msg: TrafficMessage = {
                    id: traffic.messageId,
                    timestamp: traffic.timestamp,
                    direction: traffic.direction,
                    content: traffic.content,
                    method,
                };

                setMessages((prev) => [...prev.slice(-499), msg]); // Keep last 500
            });
        }

        if (selectedServer) {
            setupListener();
        }

        return () => {
            if (unlisten) {
                unlisten();
            }
        };
    }, [selectedServer]);

    // Listen for process stopped events
    useEffect(() => {
        let unlisten: UnlistenFn | null = null;

        async function setupListener() {
            unlisten = await listen<string>("process-stopped", (event) => {
                if (event.payload === selectedServer) {
                    setIsProcessRunning(false);
                    setInspectorActive(false);
                }
            });
        }

        setupListener();

        return () => {
            if (unlisten) {
                unlisten();
            }
        };
    }, [selectedServer, setInspectorActive]);

    async function handleSpawn() {
        if (!selectedServer) return;
        try {
            await spawnServer(selectedServer);
            setIsProcessRunning(true);
            setInspectorActive(true);
            await startInspector(selectedServer);
        } catch (err) {
            console.error("Failed to spawn server:", err);
            alert(`Failed to spawn server: ${err}`);
        }
    }

    async function handleKill() {
        if (!selectedServer) return;
        try {
            await killServer(selectedServer);
            setIsProcessRunning(false);
            setInspectorActive(false);
            await stopInspector(selectedServer);
        } catch (err) {
            console.error("Failed to kill server:", err);
        }
    }

    async function handleClear() {
        if (!selectedServer) return;
        try {
            await clearInspectorMessages(selectedServer);
            setMessages([]);
            setSelectedMessage(null);
        } catch (err) {
            console.error("Failed to clear messages:", err);
        }
    }

    async function handleSendStdin() {
        if (!selectedServer || !stdinInput.trim()) return;
        try {
            await sendToServer(selectedServer, stdinInput);
            setStdinInput("");
        } catch (err) {
            console.error("Failed to send to stdin:", err);
        }
    }

    async function handleReplay(msg: TrafficMessage) {
        if (!selectedServer || msg.direction !== "OUTGOING") return;
        try {
            await sendToServer(selectedServer, msg.content);
        } catch (err) {
            console.error("Failed to replay message:", err);
        }
    }

    // Filter messages
    const filteredMessages = messages.filter((msg) => {
        // Direction filter
        if (filter !== "all") {
            if (filter === "incoming" && msg.direction !== "INCOMING") return false;
            if (filter === "outgoing" && msg.direction !== "OUTGOING") return false;
        }

        // Search filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            return (
                msg.content.toLowerCase().includes(query) ||
                (msg.method && msg.method.toLowerCase().includes(query))
            );
        }

        return true;
    });

    if (!selectedServer) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <div className="w-16 h-16 mb-4 rounded-full bg-muted flex items-center justify-center">
                    <Zap className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-medium mb-2">No Server Selected</h3>
                <p className="text-sm text-center max-w-md">
                    Select a server from the Servers view to start inspecting its JSON-RPC traffic.
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full gap-4">
            {/* Controls */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <h2 className="font-semibold">Inspecting: {selectedServer}</h2>
                    <Badge
                        variant={isProcessRunning ? "default" : "secondary"}
                        className={cn(isProcessRunning && "bg-green-600")}
                    >
                        {isProcessRunning ? "Running" : "Stopped"}
                    </Badge>
                </div>
                <div className="flex items-center gap-2">
                    {isProcessRunning ? (
                        <Button variant="destructive" size="sm" onClick={handleKill}>
                            <Square className="w-4 h-4 mr-1" />
                            Kill
                        </Button>
                    ) : (
                        <Button variant="default" size="sm" onClick={handleSpawn}>
                            <Play className="w-4 h-4 mr-1" />
                            Spawn
                        </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={handleClear}>
                        <Trash2 className="w-4 h-4 mr-1" />
                        Clear
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2">
                <div className="flex items-center border rounded-md overflow-hidden">
                    <Button
                        variant={filter === "all" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setFilter("all")}
                        className="rounded-none"
                    >
                        All
                    </Button>
                    <Button
                        variant={filter === "incoming" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setFilter("incoming")}
                        className="rounded-none"
                    >
                        <ArrowDown className="w-3 h-3 mr-1" />
                        In
                    </Button>
                    <Button
                        variant={filter === "outgoing" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setFilter("outgoing")}
                        className="rounded-none"
                    >
                        <ArrowUp className="w-3 h-3 mr-1" />
                        Out
                    </Button>
                </div>
                <div className="flex-1">
                    <Input
                        placeholder="Search messages..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-8"
                    />
                </div>
            </div>

            {/* Messages List */}
            <div className="flex-1 flex gap-4 min-h-0">
                {/* Message list */}
                <Card className="flex-1 flex flex-col overflow-hidden">
                    <CardHeader className="py-3 px-4 border-b">
                        <CardTitle className="text-sm">
                            Messages ({filteredMessages.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-auto p-0">
                        {filteredMessages.length === 0 ? (
                            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                                {messages.length === 0
                                    ? "No messages captured yet"
                                    : "No messages match filter"}
                            </div>
                        ) : (
                            <div className="divide-y">
                                {filteredMessages.map((msg) => (
                                    <button
                                        key={msg.id}
                                        className={cn(
                                            "w-full text-left px-4 py-2 hover:bg-accent transition-colors group",
                                            selectedMessage?.id === msg.id && "bg-accent"
                                        )}
                                        onClick={() => setSelectedMessage(msg)}
                                    >
                                        <div className="flex items-center gap-2">
                                            {msg.direction === "OUTGOING" ? (
                                                <ArrowUp className="w-3 h-3 text-blue-500" />
                                            ) : msg.direction === "STDERR" ? (
                                                <AlertCircle className="w-3 h-3 text-red-500" />
                                            ) : (
                                                <ArrowDown className="w-3 h-3 text-green-500" />
                                            )}
                                            <span className="font-mono text-xs truncate flex-1">
                                                {msg.method || msg.direction}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                {new Date(msg.timestamp).toLocaleTimeString()}
                                            </span>
                                            {msg.direction === "OUTGOING" && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="w-6 h-6 opacity-0 group-hover:opacity-100"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleReplay(msg);
                                                    }}
                                                    title="Replay"
                                                >
                                                    <RotateCcw className="w-3 h-3" />
                                                </Button>
                                            )}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Message detail */}
                <Card className="flex-1 flex flex-col overflow-hidden">
                    <CardHeader className="py-3 px-4 border-b">
                        <CardTitle className="text-sm">Payload</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-auto p-4">
                        {selectedMessage ? (
                            <pre className="font-mono text-xs whitespace-pre-wrap">
                                {(() => {
                                    try {
                                        return JSON.stringify(
                                            JSON.parse(selectedMessage.content),
                                            null,
                                            2
                                        );
                                    } catch {
                                        return selectedMessage.content;
                                    }
                                })()}
                            </pre>
                        ) : (
                            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                                Select a message to view details
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Stdin Input (when process is running) */}
            {isProcessRunning && (
                <div className="flex items-center gap-2 pt-2 border-t">
                    <Input
                        placeholder="Send JSON-RPC to server stdin..."
                        value={stdinInput}
                        onChange={(e) => setStdinInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                handleSendStdin();
                            }
                        }}
                        className="flex-1 font-mono text-sm"
                    />
                    <Button onClick={handleSendStdin} disabled={!stdinInput.trim()}>
                        Send
                    </Button>
                </div>
            )}
        </div>
    );
}
