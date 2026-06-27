import { describe, expect, it } from "vitest";
import { HealthChecker, type Probe } from "../src/checker.js";
import type { Target } from "../src/types.js";

const target: Target = {
  id: "t1",
  name: "T1",
  url: "https://svc.test",
  intervalMs: 1000,
  timeoutMs: 500,
};

describe("HealthChecker", () => {
  it("records latency from the injected clock", async () => {
    const times = [1000, 1120]; // start, end
    let i = 0;
    const clock = () => times[i++]!;
    const probe: Probe = async () => ({ ok: true, statusCode: 200 });
    const checker = new HealthChecker(probe, clock);

    const sample = await checker.check(target);
    expect(sample.ok).toBe(true);
    expect(sample.statusCode).toBe(200);
    expect(sample.latencyMs).toBe(120);
    expect(sample.timestamp).toBe(1120);
  });

  it("captures probe failures", async () => {
    const probe: Probe = async () => ({ ok: false, error: "ECONNREFUSED" });
    const checker = new HealthChecker(probe, () => 0);
    const sample = await checker.check(target);
    expect(sample.ok).toBe(false);
    expect(sample.error).toBe("ECONNREFUSED");
  });
});
