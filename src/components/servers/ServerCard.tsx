import { Power, MoreVertical, Trash2, Edit, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { McpServer } from "@/types";
import { cn } from "@/lib/utils";

interface ServerCardProps {
    name: string;
    server: McpServer;
    onToggle: () => void;
    onEdit: () => void;
    onDelete: () => void;
    onInspect: () => void;
}

export function ServerCard({
    name,
    server,
    onToggle,
    onEdit,
    onDelete,
    onInspect,
}: ServerCardProps) {
    const isEnabled = server.enabled;

    return (
        <Card
            className={cn(
                "group transition-all duration-200 hover:shadow-lg",
                isEnabled ? "border-green-500/30" : "border-muted opacity-75"
            )}
        >
            <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <div
                            className={cn(
                                "w-2 h-2 rounded-full",
                                isEnabled ? "bg-green-500 animate-pulse" : "bg-muted-foreground"
                            )}
                        />
                        <CardTitle className="text-lg">{name}</CardTitle>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" onClick={onInspect} title="Inspect">
                            <Search className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={onEdit} title="Edit">
                            <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onDelete}
                            title="Delete"
                            className="text-destructive hover:text-destructive"
                        >
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {/* Command */}
                    <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="font-mono text-xs">
                            {server.command}
                        </Badge>
                        <span className="text-xs text-muted-foreground truncate flex-1">
                            {server.args.join(" ")}
                        </span>
                    </div>

                    {/* Status Toggle */}
                    <div className="flex items-center justify-between pt-2 border-t">
                        <span className="text-sm text-muted-foreground">
                            {isEnabled ? "Running" : "Disabled"}
                        </span>
                        <Button
                            variant={isEnabled ? "default" : "outline"}
                            size="sm"
                            onClick={onToggle}
                            className="gap-2"
                        >
                            <Power className="w-3 h-3" />
                            {isEnabled ? "Disable" : "Enable"}
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
