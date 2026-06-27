import { describe, expect, it } from "vitest";
import {
  AlertEngine,
  consecutiveFailures,
  latencyAbove,
  uptimeBelow,
} from "../src/alerts.js";
import { RollingWindow } from "../src/metrics.js";
import type { CheckSample } from "../src/types.js";

const s = (ok: boolean, latencyMs = 10): CheckSample => ({
  ok,
  latencyMs,
  timestamp: 0,
});

describe("alert rules", () => {
  it("consecutiveFailures fires at threshold", () => {
    const w = new RollingWindow();
    const rule = consecutiveFailures(3);
    w.add(s(false));
    w.add(s(false));
    expect(rule.evaluate(w)).toBe(false);
    w.add(s(false));
    expect(rule.evaluate(w)).toBe(true);
  });

  it("latencyAbove needs min samples", () => {
    const w = new RollingWindow();
    const rule = latencyAbove(50, 95, 5);
    w.add(s(true, 100));
    expect(rule.evaluate(w)).toBe(false); // not enough samples
    for (let i = 0; i < 5; i++) w.add(s(true, 100));
    expect(rule.evaluate(w)).toBe(true);
  });

  it("uptimeBelow fires when uptime drops", () => {
    const w = new RollingWindow();
    const rule = uptimeBelow(0.9, 10);
    for (let i = 0; i < 8; i++) w.add(s(true));
    for (let i = 0; i < 2; i++) w.add(s(false));
    expect(rule.evaluate(w)).toBe(true); // 80% < 90%
  });
});

describe("AlertEngine transitions", () => {
  it("emits firing once, then resolved once (deduped)", () => {
    const w = new RollingWindow();
    const engine = new AlertEngine([consecutiveFailures(2)]);

    w.add(s(false));
    w.add(s(false));
    let events = engine.evaluate("t1", w, 1);
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe("firing");
    expect(engine.activeCount("t1")).toBe(1);

    // Still firing -> no new event.
    w.add(s(false));
    expect(engine.evaluate("t1", w, 2)).toHaveLength(0);

    // Recover -> single resolved event.
    w.add(s(true));
    events = engine.evaluate("t1", w, 3);
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe("resolved");
    expect(engine.activeCount("t1")).toBe(0);
  });
});
