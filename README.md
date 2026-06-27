# realtime-monitor

[![CI](https://github.com/rovidev95/rovidev-realtime-monitor/actions/workflows/ci.yml/badge.svg)](https://github.com/rovidev95/rovidev-realtime-monitor/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)

Polls a list of services, keeps rolling metrics (uptime, latency p50/p95) and
raises alerts on state changes. A small dashboard connects over WebSocket and
updates live — no page refresh, no Prometheus/Grafana to run.

Stack: Node + Express + `ws`, TypeScript, vanilla-JS frontend.

## What it does

- Per-service health checks at a configurable interval/timeout.
- Rolling window metrics: uptime, nearest-rank latency percentiles, consecutive
  failures.
- Alert engine that fires once when a condition starts and resolves once when it
  clears (no repeated alerts). Built-in rules: consecutive failures, latency
  above a percentile threshold, uptime below a floor.
- WebSocket fan-out to every connected dashboard.

The checker takes an injectable probe and clock, the alert engine is pure, and
the broadcast hub is decoupled from `ws`, so the whole thing is unit-tested
without real network calls.

## Run it

```bash
npm install
npm start          # http://localhost:8080
```

REST endpoints: `GET /health`, `GET /api/targets` (current snapshot).

## Targets

```bash
export MONITOR_TARGETS='[
  {"id":"api","name":"My API","url":"https://api.example.com/health","intervalMs":5000,"timeoutMs":4000},
  {"id":"web","name":"Website","url":"https://example.com","intervalMs":10000,"timeoutMs":5000}
]'
npm start
```

Without `MONITOR_TARGETS` it uses a couple of built-in defaults.

## Alert rules

```ts
import { consecutiveFailures, latencyAbove, uptimeBelow } from "./src/alerts.js";

const rules = [
  consecutiveFailures(3, "critical"),
  latencyAbove(1000, 95, 5, "warning"),
  uptimeBelow(0.9, 10, "critical"),
];
```

## Layout

```
src/
  types.ts      shared types
  metrics.ts    RollingWindow (uptime, percentiles, failures)
  alerts.ts     rule factories + AlertEngine
  checker.ts    HealthChecker (injectable probe + clock)
  monitor.ts    schedules checks, records, alerts, emits
  hub.ts        WebSocket fan-out
  config.ts     targets + rules from env
  server.ts     Express + WebSocketServer wiring
public/         live dashboard
```

## Tests

```bash
npm test
npm run typecheck
npm run lint
```

## Custom work

Need monitoring/observability tailored to your services?
Get in touch at [rovidev.com](https://rovidev.com).

## License

MIT
