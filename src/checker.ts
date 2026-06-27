import type { CheckSample, Target } from "./types.js";

export interface ProbeResult {
  ok: boolean;
  statusCode?: number;
  error?: string;
}

/** A function that probes a URL; injectable so checks are testable offline. */
export type Probe = (url: string, timeoutMs: number) => Promise<ProbeResult>;

/** Default probe using global fetch with an AbortController timeout. */
export const httpProbe: Probe = async (url, timeoutMs) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: "follow" });
    return { ok: res.ok, statusCode: res.status };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Runs a single probe and turns it into a timed CheckSample. The clock is
 * injectable so latency is deterministic in tests.
 */
export class HealthChecker {
  constructor(
    private readonly probe: Probe = httpProbe,
    private readonly clock: () => number = () => Date.now(),
  ) {}

  async check(target: Target): Promise<CheckSample> {
    const start = this.clock();
    const result = await this.probe(target.url, target.timeoutMs);
    const end = this.clock();
    return {
      timestamp: end,
      ok: result.ok,
      latencyMs: Math.max(0, end - start),
      statusCode: result.statusCode,
      error: result.error,
    };
  }
}
