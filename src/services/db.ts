/**
 * Database Service Layer
 * Provides typed access to SQLite via tauri-plugin-sql
 * Configured with WAL mode for concurrent read/write
 */

import Database from "@tauri-apps/plugin-sql";

// Types for database records
export interface SystemLog {
    id: number;
    session_id: string;
    timestamp: number;
    level: string;
    category: string;
    message: string | null;
    payload: unknown;
    trace_id: string | null;
    server_name: string | null;
    direction: string | null;
}

export interface Session {
    id: string;
    started_at: number;
    ended_at: number | null;
    server_name: string | null;
    log_count: number;
    description: string | null;
}

// Singleton database instance
let dbInstance: Database | null = null;

/**
 * Get database connection with WAL mode enabled
 */
export async function getDb(): Promise<Database> {
    if (!dbInstance) {
        dbInstance = await Database.load("sqlite:wear-synaptic.db");

        // Enable WAL mode for concurrent read/write
        await dbInstance.execute("PRAGMA journal_mode = WAL;");
        // Optimize write performance (safe with WAL)
        await dbInstance.execute("PRAGMA synchronous = NORMAL;");
        // Increase cache size for better read performance
        await dbInstance.execute("PRAGMA cache_size = -2000;"); // 2MB
    }
    return dbInstance;
}

/**
 * Insert a log entry
 */
export async function insertLog(log: Omit<SystemLog, "id">): Promise<void> {
    const db = await getDb();
    await db.execute(
        `INSERT INTO system_logs (session_id, timestamp, level, category, message, payload, trace_id, server_name, direction)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
            log.session_id,
            log.timestamp,
            log.level,
            log.category,
            log.message,
            JSON.stringify(log.payload),
            log.trace_id,
            log.server_name,
            log.direction,
        ]
    );
}

/**
 * Get logs for a session with pagination
 */
export async function getLogsBySession(
    sessionId: string,
    limit: number = 1000,
    offset: number = 0
): Promise<SystemLog[]> {
    const db = await getDb();
    const logs = await db.select<SystemLog[]>(
        `SELECT * FROM system_logs 
         WHERE session_id = $1 
         ORDER BY timestamp ASC 
         LIMIT $2 OFFSET $3`,
        [sessionId, limit, offset]
    );

    // Parse JSON payloads
    return logs.map((log) => ({
        ...log,
        payload: typeof log.payload === "string" ? JSON.parse(log.payload) : log.payload,
    }));
}

/**
 * Get log count for a session
 */
export async function getLogCount(sessionId: string): Promise<number> {
    const db = await getDb();
    const result = await db.select<{ count: number }[]>(
        "SELECT COUNT(*) as count FROM system_logs WHERE session_id = $1",
        [sessionId]
    );
    return result[0]?.count ?? 0;
}

/**
 * Create a new session
 */
export async function createSession(
    id: string,
    serverName?: string,
    description?: string
): Promise<void> {
    const db = await getDb();
    await db.execute(
        `INSERT INTO sessions (id, started_at, server_name, description)
         VALUES ($1, $2, $3, $4)`,
        [id, Date.now(), serverName ?? null, description ?? null]
    );
}

/**
 * End a session
 */
export async function endSession(sessionId: string): Promise<void> {
    const db = await getDb();
    const count = await getLogCount(sessionId);
    await db.execute(
        "UPDATE sessions SET ended_at = $1, log_count = $2 WHERE id = $3",
        [Date.now(), count, sessionId]
    );
}

/**
 * Get all sessions ordered by start time
 */
export async function getSessions(): Promise<Session[]> {
    const db = await getDb();
    return db.select<Session[]>(
        "SELECT * FROM sessions ORDER BY started_at DESC"
    );
}

/**
 * Delete a session and its logs
 */
export async function deleteSession(sessionId: string): Promise<void> {
    const db = await getDb();
    await db.execute("DELETE FROM system_logs WHERE session_id = $1", [sessionId]);
    await db.execute("DELETE FROM sessions WHERE id = $1", [sessionId]);
}

/**
 * Clear all logs (keep sessions)
 */
export async function clearAllLogs(): Promise<void> {
    const db = await getDb();
    await db.execute("DELETE FROM system_logs");
    await db.execute("UPDATE sessions SET log_count = 0");
}
