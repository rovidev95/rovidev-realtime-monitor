import {
  consecutiveFailures,
  latencyAbove,
  uptimeBelow,
  type AlertRule,
} from "./alerts.js";
import type { Target } from "./types.js";

export interface AppConfig {
  port: number;
  targets: Target[];
  rules: AlertRule[];
  snapshotIntervalMs: number;
}

const DEFAULT_TARGETS: Target[] = [
  {
    id: "example-api",
    name: "Example API",
    url: "https://example.com",
    intervalMs: 5_000,
    timeoutMs: 4_000,
  },
  {
    id: "github",
    name: "GitHub",
    url: "https://github.com",
    intervalMs: 5_000,
    timeoutMs: 4_000,
  },
];

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  let targets = DEFAULT_TARGETS;
  if (env.MONITOR_TARGETS) {
    try {
      targets = JSON.parse(env.MONITOR_TARGETS) as Target[];
    } catch {
      console.warn("Invalid MONITOR_TARGETS JSON, falling back to defaults");
    }
  }

  return {
    port: Number(env.PORT ?? 8080),
    targets,
    snapshotIntervalMs: Number(env.SNAPSHOT_INTERVAL_MS ?? 5_000),
    rules: [
      consecutiveFailures(3, "critical"),
      latencyAbove(1_000, 95, 5, "warning"),
      uptimeBelow(0.9, 10, "critical"),
    ],
  };
}
