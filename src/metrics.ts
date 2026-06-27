import type { CheckSample } from "./types.js";

/**
 * Fixed-capacity rolling window of check samples. Computes uptime and latency
 * percentiles over the retained window.
 */
export class RollingWindow {
  private readonly buffer: CheckSample[] = [];

  constructor(private readonly capacity: number = 200) {
    if (capacity <= 0) throw new Error("capacity must be positive");
  }

  add(sample: CheckSample): void {
    this.buffer.push(sample);
    if (this.buffer.length > this.capacity) {
      this.buffer.shift();
    }
  }

  get size(): number {
    return this.buffer.length;
  }

  samples(): readonly CheckSample[] {
    return this.buffer;
  }

  last(): CheckSample | null {
    return this.buffer.at(-1) ?? null;
  }

  /** Fraction of successful checks in [0, 1]. Returns 1 when empty. */
  uptime(): number {
    if (this.buffer.length === 0) return 1;
    const ok = this.buffer.reduce((n, s) => n + (s.ok ? 1 : 0), 0);
    return ok / this.buffer.length;
  }

  /** Count of trailing consecutive failures (newest first). */
  consecutiveFailures(): number {
    let count = 0;
    for (let i = this.buffer.length - 1; i >= 0; i--) {
      if (this.buffer[i]!.ok) break;
      count++;
    }
    return count;
  }

  /** Nearest-rank percentile of latency over successful samples. */
  latencyPercentile(p: number): number {
    if (p < 0 || p > 100) throw new Error("percentile must be in [0, 100]");
    const latencies = this.buffer
      .filter((s) => s.ok)
      .map((s) => s.latencyMs)
      .sort((a, b) => a - b);
    if (latencies.length === 0) return 0;
    if (p === 0) return latencies[0]!;
    const rank = Math.ceil((p / 100) * latencies.length);
    return latencies[Math.min(rank, latencies.length) - 1]!;
  }

  averageLatency(): number {
    const ok = this.buffer.filter((s) => s.ok);
    if (ok.length === 0) return 0;
    return ok.reduce((sum, s) => sum + s.latencyMs, 0) / ok.length;
  }
}
