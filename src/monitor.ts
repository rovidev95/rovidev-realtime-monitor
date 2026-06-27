import { AlertEngine, type AlertRule } from "./alerts.js";
import { HealthChecker } from "./checker.js";
import { RollingWindow } from "./metrics.js";
import type {
  AlertEvent,
  CheckSample,
  Target,
  TargetSnapshot,
  TargetStatus,
} from "./types.js";

export type MonitorListener = (
  event:
    | { kind: "sample"; targetId: string; sample: CheckSample }
    | { kind: "alert"; event: AlertEvent },
) => void;

interface Entry {
  target: Target;
  window: RollingWindow;
  timer?: ReturnType<typeof setInterval>;
}

export interface MonitorOptions {
  windowCapacity?: number;
  rules?: AlertRule[];
  checker?: HealthChecker;
  clock?: () => number;
}

/**
 * Schedules checks, records metrics, runs the alert engine and notifies
 * listeners. `tick` runs a single check; `start`/`stop` manage the timers.
 */
export class MonitorManager {
  private readonly entries = new Map<string, Entry>();
  private readonly listeners = new Set<MonitorListener>();
  private readonly engine: AlertEngine;
  private readonly checker: HealthChecker;
  private readonly windowCapacity: number;
  private readonly clock: () => number;

  constructor(options: MonitorOptions = {}) {
    this.windowCapacity = options.windowCapacity ?? 200;
    this.engine = new AlertEngine(options.rules ?? []);
    this.checker = options.checker ?? new HealthChecker();
    this.clock = options.clock ?? (() => Date.now());
  }

  addTarget(target: Target): void {
    this.entries.set(target.id, {
      target,
      window: new RollingWindow(this.windowCapacity),
    });
  }

  removeTarget(targetId: string): void {
    const entry = this.entries.get(targetId);
    if (entry?.timer) clearInterval(entry.timer);
    this.entries.delete(targetId);
  }

  onEvent(listener: MonitorListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Run one check for a target and process the result. */
  async tick(targetId: string): Promise<CheckSample> {
    const entry = this.entries.get(targetId);
    if (!entry) throw new Error(`unknown target: ${targetId}`);

    const sample = await this.checker.check(entry.target);
    entry.window.add(sample);
    this.emit({ kind: "sample", targetId, sample });

    const events = this.engine.evaluate(targetId, entry.window, this.clock());
    for (const event of events) {
      this.emit({ kind: "alert", event });
    }
    return sample;
  }

  /** Start periodic checks for every target using their interval. */
  start(): void {
    for (const entry of this.entries.values()) {
      if (entry.timer) continue;
      entry.timer = setInterval(() => {
        void this.tick(entry.target.id);
      }, entry.target.intervalMs);
    }
  }

  stop(): void {
    for (const entry of this.entries.values()) {
      if (entry.timer) {
        clearInterval(entry.timer);
        entry.timer = undefined;
      }
    }
  }

  snapshot(): TargetSnapshot[] {
    return [...this.entries.values()].map((entry) => {
      const { target, window } = entry;
      const activeAlerts = this.engine.activeCount(target.id);
      return {
        target,
        status: this.deriveStatus(window, activeAlerts),
        uptime: window.uptime(),
        latencyP50: window.latencyPercentile(50),
        latencyP95: window.latencyPercentile(95),
        lastSample: window.last(),
        activeAlerts,
      };
    });
  }

  private deriveStatus(window: RollingWindow, activeAlerts: number): TargetStatus {
    const last = window.last();
    if (!last) return "unknown";
    if (!last.ok) return "down";
    return activeAlerts > 0 ? "degraded" : "up";
  }

  private emit(event: Parameters<MonitorListener>[0]): void {
    for (const listener of this.listeners) listener(event);
  }
}
