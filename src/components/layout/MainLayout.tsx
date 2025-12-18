import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

interface MainLayoutProps {
    children: ReactNode;
    onAddServer?: () => void;
    onRefresh?: () => void;
}

export function MainLayout({ children, onAddServer, onRefresh }: MainLayoutProps) {
    return (
        <div className="flex h-screen bg-background">
            <Sidebar />
            <div className="flex-1 flex flex-col overflow-hidden">
                <Header onAddServer={onAddServer} onRefresh={onRefresh} />
                <main className="flex-1 overflow-auto p-4 lg:p-6">{children}</main>
            </div>
        </div>
    );
}
