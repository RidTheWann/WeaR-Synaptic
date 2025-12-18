/**
 * Virtualized Log Viewer Component
 * Uses react-virtuoso for windowed rendering of large log datasets
 * Supports dynamic height, auto-scroll, and memoized rows
 */

import React, { useRef, useCallback, memo, useState } from "react";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";
import { ArrowUp, ArrowDown, AlertCircle, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// Log entry type (matches SystemLog from db.ts)
export interface LogEntry {
    id: number;
    timestamp: number;
    level: string;
    category: string;
    message: string | null;
    payload: unknown;
    direction: string | null;
    server_name: string | null;
}

interface VirtualizedLogViewerProps {
    logs: LogEntry[];
    autoScroll?: boolean;
    onAutoScrollChange?: (enabled: boolean) => void;
    className?: string;
}

// Memoized Log Row Component
const LogRow = memo(function LogRow({
    log,
    isExpanded,
    onToggle,
}: {
    log: LogEntry;
    isExpanded: boolean;
    onToggle: () => void;
}) {
    const directionIcon = () => {
        switch (log.direction) {
            case "OUTGOING":
                return <ArrowUp className="w-3 h-3 text-blue-500 flex-shrink-0" />;
            case "INCOMING":
                return <ArrowDown className="w-3 h-3 text-green-500 flex-shrink-0" />;
            case "STDERR":
                return <AlertCircle className="w-3 h-3 text-red-500 flex-shrink-0" />;
            default:
                return null;
        }
    };

    const levelColor = () => {
        switch (log.level?.toUpperCase()) {
            case "ERROR":
                return "text-red-400";
            case "WARN":
                return "text-yellow-400";
            case "DEBUG":
                return "text-gray-500";
            default:
                return "text-foreground";
        }
    };

    const formatPayload = () => {
        if (!log.payload) return null;
        try {
            return JSON.stringify(log.payload, null, 2);
        } catch {
            return String(log.payload);
        }
    };

    const payloadStr = formatPayload();
    const hasPayload = payloadStr && payloadStr !== "null";

    return (
        <div className="border-b border-border/50 hover:bg-accent/30 transition-colors">
            <button
                className="w-full text-left px-3 py-2 flex items-start gap-2"
                onClick={onToggle}
                disabled={!hasPayload}
            >
                {/* Expand icon */}
                {hasPayload ? (
                    isExpanded ? (
                        <ChevronDown className="w-3 h-3 mt-1 flex-shrink-0" />
                    ) : (
                        <ChevronRight className="w-3 h-3 mt-1 flex-shrink-0" />
                    )
                ) : (
                    <div className="w-3 h-3" />
                )}

                {/* Direction icon */}
                {directionIcon()}

                {/* Time */}
                <span className="text-xs text-muted-foreground font-mono w-20 flex-shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString()}
                </span>

                {/* Level */}
                <span className={cn("text-xs font-medium w-12 flex-shrink-0", levelColor())}>
                    {log.level}
                </span>

                {/* Category */}
                <span className="text-xs text-muted-foreground w-16 truncate flex-shrink-0">
                    {log.category}
                </span>

                {/* Message */}
                <span className="text-xs flex-1 truncate">
                    {log.message || (log.payload ? "JSON payload" : "—")}
                </span>
            </button>

            {/* Expanded payload */}
            {isExpanded && hasPayload && (
                <div className="px-3 pb-2 pl-12">
                    <pre className="text-xs font-mono bg-muted/50 p-2 rounded overflow-x-auto max-h-64">
                        {payloadStr}
                    </pre>
                </div>
            )}
        </div>
    );
});

export function VirtualizedLogViewer({
    logs,
    autoScroll = true,
    onAutoScrollChange,
    className,
}: VirtualizedLogViewerProps) {
    const virtuosoRef = useRef<VirtuosoHandle>(null);
    const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

    const toggleExpanded = useCallback((id: number) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    }, []);

    const handleAtBottomChange = useCallback(
        (atBottom: boolean) => {
            if (onAutoScrollChange) {
                onAutoScrollChange(atBottom);
            }
        },
        [onAutoScrollChange]
    );

    return (
        <div className={cn("h-full w-full", className)}>
            <Virtuoso
                ref={virtuosoRef}
                data={logs}
                totalCount={logs.length}
                followOutput={autoScroll ? "smooth" : false}
                overscan={200}
                atBottomStateChange={handleAtBottomChange}
                itemContent={(index, log) => (
                    <LogRow
                        log={log}
                        isExpanded={expandedIds.has(log.id)}
                        onToggle={() => toggleExpanded(log.id)}
                    />
                )}
                components={{
                    EmptyPlaceholder: () => (
                        <div className="flex items-center justify-center h-full text-muted-foreground text-sm py-8">
                            No logs to display
                        </div>
                    ),
                }}
            />
        </div>
    );
}

export default VirtualizedLogViewer;
