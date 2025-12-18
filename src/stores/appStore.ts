/**
 * Zustand global store for WeaR-Synaptic UI state
 */

import { create } from "zustand";
import type { McpServer, InspectorMessage, ActiveView } from "../types";

interface AppState {
    // UI State
    sidebarOpen: boolean;
    activeView: ActiveView;

    // Server State
    servers: Record<string, McpServer>;
    selectedServer: string | null;

    // Inspector State
    inspectorActive: boolean;
    inspectorMessages: InspectorMessage[];

    // Actions
    setSidebarOpen: (open: boolean) => void;
    setActiveView: (view: ActiveView) => void;
    setServers: (servers: Record<string, McpServer>) => void;
    selectServer: (name: string | null) => void;
    addInspectorMessage: (message: InspectorMessage) => void;
    clearInspectorMessages: () => void;
    setInspectorActive: (active: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
    // Initial State
    sidebarOpen: true,
    activeView: "servers",
    servers: {},
    selectedServer: null,
    inspectorActive: false,
    inspectorMessages: [],

    // Actions
    setSidebarOpen: (open) => set({ sidebarOpen: open }),

    setActiveView: (view) => set({ activeView: view }),

    setServers: (servers) => set({ servers }),

    selectServer: (name) => set({ selectedServer: name }),

    addInspectorMessage: (message) =>
        set((state) => ({
            inspectorMessages: [...state.inspectorMessages, message].slice(-500), // Keep last 500
        })),

    clearInspectorMessages: () => set({ inspectorMessages: [] }),

    setInspectorActive: (active) => set({ inspectorActive: active }),
}));
