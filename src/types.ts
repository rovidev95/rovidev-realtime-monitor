export type TargetStatus = "up" | "degraded" | "down" | "unknown";

export interface Target {
  id: string;
  name: string;
  url: string;
  /** Check interval in ms. */
  intervalMs: number;
  /** Per-check timeout in ms. */
  timeoutMs: number;
}

export interface CheckSample {
  timestamp: number;
  ok: boolean;
  latencyMs: number;
  statusCode?: number;
  error?: string;
}

export type AlertSeverity = "warning" | "critical";

export interface AlertEvent {
  type: "firing" | "resolved";
  targetId: string;
  ruleId: string;
  severity: AlertSeverity;
  description: string;
  at: number;
}

export interface TargetSnapshot {
  target: Target;
  status: TargetStatus;
  uptime: number;
  latencyP50: number;
  latencyP95: number;
  lastSample: CheckSample | null;
  activeAlerts: number;
}

/** Messages pushed to dashboard clients over WebSocket. */
export type ServerMessage =
  | { kind: "snapshot"; targets: TargetSnapshot[]; at: number }
  | { kind: "sample"; targetId: string; sample: CheckSample }
  | { kind: "alert"; event: AlertEvent };
