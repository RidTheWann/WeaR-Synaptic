import { Server } from "lucide-react";
import { ServerCard } from "./ServerCard";
import type { McpServer } from "@/types";

interface ServerListProps {
    servers: Record<string, McpServer>;
    onToggle: (name: string) => void;
    onEdit: (name: string) => void;
    onDelete: (name: string) => void;
    onInspect: (name: string) => void;
}

export function ServerList({
    servers,
    onToggle,
    onEdit,
    onDelete,
    onInspect,
}: ServerListProps) {
    const serverEntries = Object.entries(servers);

    if (serverEntries.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Server className="w-16 h-16 mb-4 opacity-20" />
                <h3 className="text-lg font-medium mb-2">No MCP Servers Configured</h3>
                <p className="text-sm text-center max-w-md">
                    Add your first MCP server to get started. You can add servers manually
                    or browse the registry for popular options.
                </p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {serverEntries.map(([name, server]) => (
                <ServerCard
                    key={name}
                    name={name}
                    server={server}
                    onToggle={() => onToggle(name)}
                    onEdit={() => onEdit(name)}
                    onDelete={() => onDelete(name)}
                    onInspect={() => onInspect(name)}
                />
            ))}
        </div>
    );
}
