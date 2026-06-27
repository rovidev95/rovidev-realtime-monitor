import type { RollingWindow } from "./metrics.js";
import type { AlertEvent, AlertSeverity } from "./types.js";

export interface AlertRule {
  id: string;
  severity: AlertSeverity;
  description: string;
  /** True when the condition is currently met (i.e. should be firing). */
  evaluate(window: RollingWindow): boolean;
}

/** Fire after N consecutive failed checks. */
export function consecutiveFailures(
  n: number,
  severity: AlertSeverity = "critical",
): AlertRule {
  return {
    id: `consecutive_failures_${n}`,
    severity,
    description: `Service failed ${n} consecutive checks`,
    evaluate: (w) => w.consecutiveFailures() >= n,
  };
}

/** Fire when a latency percentile exceeds a threshold (needs min samples). */
export function latencyAbove(
  thresholdMs: number,
  percentile = 95,
  minSamples = 5,
  severity: AlertSeverity = "warning",
): AlertRule {
  return {
    id: `latency_p${percentile}_above_${thresholdMs}`,
    severity,
    description: `p${percentile} latency above ${thresholdMs}ms`,
    evaluate: (w) =>
      w.size >= minSamples && w.latencyPercentile(percentile) > thresholdMs,
  };
}

/** Fire when uptime over the window drops below a fraction. */
export function uptimeBelow(
  fraction: number,
  minSamples = 10,
  severity: AlertSeverity = "critical",
): AlertRule {
  return {
    id: `uptime_below_${fraction}`,
    severity,
    description: `Uptime below ${(fraction * 100).toFixed(0)}%`,
    evaluate: (w) => w.size >= minSamples && w.uptime() < fraction,
  };
}

/**
 * Tracks firing state per (target, rule) and emits transition events only when
 * an alert starts firing or resolves — never on every evaluation (dedup).
 */
export class AlertEngine {
  private readonly firing = new Set<string>();

  constructor(private readonly rules: AlertRule[]) {}

  /** Number of currently-firing alerts for a target. */
  activeCount(targetId: string): number {
    let count = 0;
    for (const rule of this.rules) {
      if (this.firing.has(this.key(targetId, rule.id))) count++;
    }
    return count;
  }

  /** Evaluate all rules for a target; return only state-transition events. */
  evaluate(targetId: string, window: RollingWindow, at: number): AlertEvent[] {
    const events: AlertEvent[] = [];
    for (const rule of this.rules) {
      const key = this.key(targetId, rule.id);
      const shouldFire = rule.evaluate(window);
      const isFiring = this.firing.has(key);

      if (shouldFire && !isFiring) {
        this.firing.add(key);
        events.push({
          type: "firing",
          targetId,
          ruleId: rule.id,
          severity: rule.severity,
          description: rule.description,
          at,
        });
      } else if (!shouldFire && isFiring) {
        this.firing.delete(key);
        events.push({
          type: "resolved",
          targetId,
          ruleId: rule.id,
          severity: rule.severity,
          description: rule.description,
          at,
        });
      }
    }
    return events;
  }

  private key(targetId: string, ruleId: string): string {
    return `${targetId}::${ruleId}`;
  }
}
