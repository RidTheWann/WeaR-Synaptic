import { Server, Search, Package, Settings, Menu, X } from "lucide-react";
import { useAppStore } from "@/stores/appStore";
import { cn } from "@/lib/utils";
import type { ActiveView } from "@/types";

interface NavItem {
    id: ActiveView;
    label: string;
    icon: React.ReactNode;
}

const navItems: NavItem[] = [
    { id: "servers", label: "Servers", icon: <Server className="w-5 h-5" /> },
    { id: "inspector", label: "Inspector", icon: <Search className="w-5 h-5" /> },
    { id: "registry", label: "Registry", icon: <Package className="w-5 h-5" /> },
    { id: "settings", label: "Settings", icon: <Settings className="w-5 h-5" /> },
];

export function Sidebar() {
    const { sidebarOpen, activeView, setActiveView, setSidebarOpen } = useAppStore();

    return (
        <>
            {/* Mobile overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={cn(
                    "fixed lg:static inset-y-0 left-0 z-50 w-64 bg-card border-r transition-transform duration-300 ease-in-out flex flex-col",
                    sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
                )}
            >
                {/* Logo */}
                <div className="h-16 flex items-center justify-between px-4 border-b">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                            <Server className="w-4 h-4 text-white" />
                        </div>
                        <span className="font-bold text-lg bg-gradient-to-r from-blue-500 to-indigo-600 bg-clip-text text-transparent">
                            Synaptic
                        </span>
                    </div>
                    <button
                        onClick={() => setSidebarOpen(false)}
                        className="lg:hidden p-2 hover:bg-accent rounded-md"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-4 space-y-1">
                    {navItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => {
                                setActiveView(item.id);
                                setSidebarOpen(false);
                            }}
                            className={cn(
                                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                                activeView === item.id
                                    ? "bg-primary text-primary-foreground shadow-sm"
                                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                            )}
                        >
                            {item.icon}
                            {item.label}
                        </button>
                    ))}
                </nav>

                {/* Footer */}
                <div className="p-4 border-t">
                    <p className="text-xs text-muted-foreground text-center">
                        Synaptic v0.1.0
                    </p>
                </div>
            </aside>
        </>
    );
}
