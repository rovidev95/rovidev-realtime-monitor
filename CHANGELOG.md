# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres
to [Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-06-27

### Added
- Per-service health checks with configurable interval and timeout.
- Rolling-window metrics: uptime and latency percentiles (p50/p95).
- Alert engine with consecutive-failure, latency-threshold and uptime-floor rules.
- Live WebSocket dashboard with fan-out to all connected clients.
