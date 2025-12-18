import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { ServerList } from "@/components/servers/ServerList";
import { ServerFormModal, ServerFormData } from "@/components/servers/ServerFormModal";
import { RegistryBrowser } from "@/components/registry/RegistryBrowser";
import { InspectorPanel } from "@/components/inspector/InspectorPanel";
import { SettingsPanel } from "@/components/settings/SettingsPanel";
import { useAppStore } from "@/stores/appStore";
import { readConfig, toggleServer, removeServer, addServer, updateServer } from "@/lib/tauri";
import type { McpServer } from "@/types";
import "./index.css";

function App() {
  const { activeView, servers, setServers, selectServer, setActiveView } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<{ name: string; data: ServerFormData } | null>(null);

  // Load config on mount
  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    try {
      setLoading(true);
      setError(null);
      const config = await readConfig();
      setServers(config.mcpServers || {});
    } catch (err) {
      console.error("Failed to load config:", err);
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle(name: string) {
    const server = servers[name];
    if (!server) return;

    try {
      await toggleServer(name, !server.enabled);
      await loadConfig();
    } catch (err) {
      console.error("Failed to toggle server:", err);
    }
  }

  async function handleDelete(name: string) {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;

    try {
      await removeServer(name);
      await loadConfig();
    } catch (err) {
      console.error("Failed to delete server:", err);
    }
  }

  function handleEdit(name: string) {
    const server = servers[name];
    if (!server) return;

    // Convert McpServer to ServerFormData
    const formData: ServerFormData = {
      name,
      transport: "stdio", // Default to stdio since we don't store transport type yet
      command: server.command,
      args: server.args.map((a) => ({ value: a })),
      env: Object.entries(server.env).map(([key, value]) => ({ key, value })),
      url: "",
    };

    setEditingServer({ name, data: formData });
    setIsModalOpen(true);
  }

  function handleInspect(name: string) {
    selectServer(name);
    setActiveView("inspector");
  }

  function handleAddServer() {
    setEditingServer(null);
    setIsModalOpen(true);
  }

  function handleModalClose() {
    setIsModalOpen(false);
    setEditingServer(null);
  }

  async function handleFormSubmit(name: string, data: ServerFormData) {
    // Convert ServerFormData to McpServer
    const mcpServer: McpServer = {
      command: data.command || "",
      args: data.args.map((a) => a.value).filter((v) => v.trim() !== ""),
      env: data.env.reduce((acc, { key, value }) => {
        if (key.trim() !== "") {
          acc[key] = value;
        }
        return acc;
      }, {} as Record<string, string>),
      enabled: true,
    };

    if (editingServer) {
      await updateServer(editingServer.name, mcpServer);
    } else {
      await addServer(name, mcpServer);
    }

    await loadConfig();
  }

  // Render loading state
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading configuration...</p>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">⚠️</span>
          </div>
          <h2 className="text-xl font-semibold mb-2">Configuration Error</h2>
          <p className="text-muted-foreground text-sm mb-4">{error}</p>
          <button
            onClick={loadConfig}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Render main content based on active view
  const renderContent = () => {
    switch (activeView) {
      case "servers":
        return (
          <ServerList
            servers={servers}
            onToggle={handleToggle}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onInspect={handleInspect}
          />
        );
      case "registry":
        return <RegistryBrowser onInstall={loadConfig} />;
      case "inspector":
        return <InspectorPanel />;
      case "settings":
        return <SettingsPanel />;
      default:
        return null;
    }
  };

  return (
    <div className="dark">
      <MainLayout onAddServer={handleAddServer} onRefresh={loadConfig}>
        {renderContent()}
      </MainLayout>

      {/* Server Form Modal */}
      <ServerFormModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSubmit={handleFormSubmit}
        editingServer={editingServer}
        existingNames={Object.keys(servers)}
      />
    </div>
  );
}

export default App;

