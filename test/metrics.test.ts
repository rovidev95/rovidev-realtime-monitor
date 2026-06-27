import { describe, expect, it } from "vitest";
import { RollingWindow } from "../src/metrics.js";
import type { CheckSample } from "../src/types.js";

function sample(ok: boolean, latencyMs: number, ts = 0): CheckSample {
  return { ok, latencyMs, timestamp: ts };
}

describe("RollingWindow", () => {
  it("respects capacity (evicts oldest)", () => {
    const w = new RollingWindow(3);
    w.add(sample(true, 10));
    w.add(sample(true, 20));
    w.add(sample(true, 30));
    w.add(sample(true, 40));
    expect(w.size).toBe(3);
    expect(w.samples()[0]!.latencyMs).toBe(20);
  });

  it("computes uptime", () => {
    const w = new RollingWindow();
    w.add(sample(true, 10));
    w.add(sample(false, 0));
    w.add(sample(true, 10));
    w.add(sample(true, 10));
    expect(w.uptime()).toBe(0.75);
  });

  it("uptime is 1 when empty", () => {
    expect(new RollingWindow().uptime()).toBe(1);
  });

  it("counts trailing consecutive failures", () => {
    const w = new RollingWindow();
    w.add(sample(true, 5));
    w.add(sample(false, 0));
    w.add(sample(false, 0));
    expect(w.consecutiveFailures()).toBe(2);
    w.add(sample(true, 5));
    expect(w.consecutiveFailures()).toBe(0);
  });

  it("computes nearest-rank percentiles over ok samples", () => {
    const w = new RollingWindow();
    for (const v of [10, 20, 30, 40, 50]) w.add(sample(true, v));
    expect(w.latencyPercentile(50)).toBe(30);
    expect(w.latencyPercentile(95)).toBe(50);
    expect(w.latencyPercentile(0)).toBe(10);
  });

  it("ignores failed samples in latency stats", () => {
    const w = new RollingWindow();
    w.add(sample(true, 100));
    w.add(sample(false, 9999));
    expect(w.averageLatency()).toBe(100);
    expect(w.latencyPercentile(95)).toBe(100);
  });

  it("rejects invalid percentile", () => {
    expect(() => new RollingWindow().latencyPercentile(150)).toThrow();
  });
});
