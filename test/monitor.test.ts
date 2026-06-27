import { describe, expect, it, vi } from "vitest";
import { MonitorManager } from "../src/monitor.js";
import { HealthChecker, type Probe } from "../src/checker.js";
import { consecutiveFailures } from "../src/alerts.js";
import { Hub, type Client } from "../src/hub.js";
import type { Target } from "../src/types.js";

const target: Target = {
  id: "api",
  name: "API",
  url: "https://api.test",
  intervalMs: 1000,
  timeoutMs: 500,
};

function managerWith(probe: Probe) {
  return new MonitorManager({
    checker: new HealthChecker(probe, () => 0),
    rules: [consecutiveFailures(2, "critical")],
    clock: () => 123,
  });
}

describe("MonitorManager", () => {
  it("records samples and exposes a snapshot", async () => {
    const mgr = managerWith(async () => ({ ok: true, statusCode: 200 }));
    mgr.addTarget(target);
    await mgr.tick("api");

    const [snap] = mgr.snapshot();
    expect(snap!.status).toBe("up");
    expect(snap!.uptime).toBe(1);
    expect(snap!.lastSample?.ok).toBe(true);
  });

  it("derives 'down' status and fires an alert after consecutive failures", async () => {
    const mgr = managerWith(async () => ({ ok: false, error: "boom" }));
    mgr.addTarget(target);
    const events: string[] = [];
    mgr.onEvent((e) => {
      if (e.kind === "alert") events.push(`${e.event.type}:${e.event.ruleId}`);
    });

    await mgr.tick("api");
    await mgr.tick("api"); // 2nd consecutive failure -> fire

    const [snap] = mgr.snapshot();
    expect(snap!.status).toBe("down");
    expect(snap!.activeAlerts).toBe(1);
    expect(events).toContain("firing:consecutive_failures_2");
  });

  it("broadcasts samples to a Hub via listener", async () => {
    const mgr = managerWith(async () => ({ ok: true, statusCode: 200 }));
    mgr.addTarget(target);
    const hub = new Hub();
    const sent: string[] = [];
    const client: Client = { send: (d) => sent.push(d), readyState: 1 };
    hub.add(client);
    mgr.onEvent((e) => {
      if (e.kind === "sample") {
        hub.broadcast({ kind: "sample", targetId: e.targetId, sample: e.sample });
      }
    });

    await mgr.tick("api");
    expect(sent).toHaveLength(1);
    expect(JSON.parse(sent[0]!).kind).toBe("sample");
  });

  it("throws on unknown target tick", async () => {
    const mgr = managerWith(async () => ({ ok: true }));
    await expect(mgr.tick("nope")).rejects.toThrow();
  });

  it("start/stop manage timers without throwing", () => {
    vi.useFakeTimers();
    const mgr = managerWith(async () => ({ ok: true }));
    mgr.addTarget(target);
    mgr.start();
    mgr.stop();
    vi.useRealTimers();
  });
});
