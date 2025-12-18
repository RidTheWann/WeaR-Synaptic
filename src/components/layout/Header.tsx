import { Menu, Plus, RefreshCw } from "lucide-react";
import { useAppStore } from "@/stores/appStore";
import { Button } from "@/components/ui/button";

interface HeaderProps {
    onAddServer?: () => void;
    onRefresh?: () => void;
}

export function Header({ onAddServer, onRefresh }: HeaderProps) {
    const { activeView, setSidebarOpen } = useAppStore();

    const titles: Record<string, string> = {
        servers: "MCP Servers",
        inspector: "Inspector",
        registry: "Server Registry",
        settings: "Settings",
    };

    return (
        <header className="h-16 border-b bg-card flex items-center justify-between px-4 lg:px-6">
            <div className="flex items-center gap-4">
                <button
                    onClick={() => setSidebarOpen(true)}
                    className="lg:hidden p-2 hover:bg-accent rounded-md"
                >
                    <Menu className="w-5 h-5" />
                </button>
                <h1 className="text-xl font-semibold">{titles[activeView]}</h1>
            </div>

            <div className="flex items-center gap-2">
                {onRefresh && (
                    <Button variant="ghost" size="icon" onClick={onRefresh}>
                        <RefreshCw className="w-4 h-4" />
                    </Button>
                )}
                {activeView === "servers" && onAddServer && (
                    <Button onClick={onAddServer} className="gap-2">
                        <Plus className="w-4 h-4" />
                        <span className="hidden sm:inline">Add Server</span>
                    </Button>
                )}
            </div>
        </header>
    );
}
