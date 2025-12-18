/**
 * Replay Engine for Time-Travel Debugging
 * 
 * Implements self-correcting time scheduler using performance.now()
 * with read-ahead buffering for smooth playback of historical logs.
 */

import { getLogsBySession, getLogCount, type SystemLog } from "./db";

export type ReplayStatus = "idle" | "playing" | "paused" | "ended";

export interface ReplayEngineOptions {
    /** Callback for each emitted log */
    onLog: (log: SystemLog) => void;
    /** Callback for status changes */
    onStatusChange?: (status: ReplayStatus) => void;
    /** Callback for progress updates (0-1) */
    onProgress?: (progress: number) => void;
    /** Batch size for prefetching */
    batchSize?: number;
    /** Refetch threshold (remaining items before prefetch) */
    refetchThreshold?: number;
}

export class ReplayEngine {
    private sessionId: string;
    private options: Required<ReplayEngineOptions>;

    // Playback state
    private status: ReplayStatus = "idle";
    private speed: number = 1.0;
    private queue: SystemLog[] = [];
    private offset: number = 0;
    private totalLogs: number = 0;
    private emittedCount: number = 0;

    // Timing state
    private startTime: number = 0;
    private simulationTimeStart: number = 0;
    private pausedAt: number = 0;

    // Animation frame handle
    private rafHandle: number | null = null;
    private isFetching: boolean = false;

    constructor(sessionId: string, options: ReplayEngineOptions) {
        this.sessionId = sessionId;
        this.options = {
            onLog: options.onLog,
            onStatusChange: options.onStatusChange ?? (() => { }),
            onProgress: options.onProgress ?? (() => { }),
            batchSize: options.batchSize ?? 1000,
            refetchThreshold: options.refetchThreshold ?? 200,
        };
    }

    /**
     * Start or resume playback
     */
    async start(): Promise<void> {
        if (this.status === "playing") return;

        // Initialize if idle
        if (this.status === "idle") {
            this.offset = 0;
            this.queue = [];
            this.emittedCount = 0;
            this.totalLogs = await getLogCount(this.sessionId);

            if (this.totalLogs === 0) {
                this.setStatus("ended");
                return;
            }

            await this.fetchNextBatch();

            if (this.queue.length === 0) {
                this.setStatus("ended");
                return;
            }

            this.simulationTimeStart = this.queue[0].timestamp;
            this.startTime = performance.now();
        }

        // Resume from pause
        if (this.status === "paused") {
            const pauseDuration = performance.now() - this.pausedAt;
            this.startTime += pauseDuration;
        }

        this.setStatus("playing");
        this.tick();
    }

    /**
     * Pause playback
     */
    pause(): void {
        if (this.status !== "playing") return;

        this.pausedAt = performance.now();
        this.setStatus("paused");

        if (this.rafHandle !== null) {
            cancelAnimationFrame(this.rafHandle);
            this.rafHandle = null;
        }
    }

    /**
     * Stop and reset playback
     */
    stop(): void {
        if (this.rafHandle !== null) {
            cancelAnimationFrame(this.rafHandle);
            this.rafHandle = null;
        }

        this.queue = [];
        this.offset = 0;
        this.emittedCount = 0;
        this.setStatus("idle");
    }

    /**
     * Set playback speed multiplier
     */
    setSpeed(multiplier: number): void {
        if (multiplier <= 0) return;

        // Adjust start time to maintain position when changing speed
        if (this.status === "playing") {
            const now = performance.now();
            const realElapsed = now - this.startTime;
            const simElapsed = realElapsed * this.speed;

            this.startTime = now - (simElapsed / multiplier);
        }

        this.speed = multiplier;
    }

    /**
     * Get current speed
     */
    getSpeed(): number {
        return this.speed;
    }

    /**
     * Get current status
     */
    getStatus(): ReplayStatus {
        return this.status;
    }

    /**
     * Seek to a specific position (0-1)
     */
    async seek(position: number): Promise<void> {
        if (position < 0 || position > 1) return;

        const wasPlaying = this.status === "playing";
        this.pause();

        // Calculate target offset
        const targetOffset = Math.floor(this.totalLogs * position);
        this.offset = targetOffset;
        this.emittedCount = targetOffset;
        this.queue = [];

        await this.fetchNextBatch();

        if (this.queue.length > 0) {
            this.simulationTimeStart = this.queue[0].timestamp;
            this.startTime = performance.now();
        }

        this.options.onProgress(position);

        if (wasPlaying) {
            this.start();
        }
    }

    /**
     * Main animation loop - self-correcting time scheduler
     */
    private tick = (): void => {
        if (this.status !== "playing") return;

        const now = performance.now();
        const realElapsed = (now - this.startTime) * this.speed;
        const targetTime = this.simulationTimeStart + realElapsed;

        // Emit all logs up to current simulated time
        while (this.queue.length > 0 && this.queue[0].timestamp <= targetTime) {
            const log = this.queue.shift()!;
            this.options.onLog(log);
            this.emittedCount++;

            // Update progress
            this.options.onProgress(this.emittedCount / this.totalLogs);
        }

        // Read-ahead buffering
        if (this.queue.length < this.options.refetchThreshold && !this.isFetching) {
            this.fetchNextBatch();
        }

        // Check if done
        if (this.queue.length === 0 && this.offset >= this.totalLogs) {
            this.setStatus("ended");
            return;
        }

        // Schedule next frame
        this.rafHandle = requestAnimationFrame(this.tick);
    };

    /**
     * Fetch next batch of logs
     */
    private async fetchNextBatch(): Promise<void> {
        if (this.isFetching) return;

        this.isFetching = true;
        try {
            const logs = await getLogsBySession(
                this.sessionId,
                this.options.batchSize,
                this.offset
            );

            this.queue.push(...logs);
            this.offset += logs.length;
        } finally {
            this.isFetching = false;
        }
    }

    /**
     * Update status and notify listeners
     */
    private setStatus(status: ReplayStatus): void {
        this.status = status;
        this.options.onStatusChange(status);
    }
}
