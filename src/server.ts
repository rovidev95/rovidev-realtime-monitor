import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import express from "express";
import { WebSocketServer } from "ws";

import { loadConfig } from "./config.js";
import { Hub } from "./hub.js";
import { MonitorManager } from "./monitor.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function main(): void {
  const config = loadConfig();
  const monitor = new MonitorManager({ rules: config.rules });
  const hub = new Hub();

  for (const target of config.targets) monitor.addTarget(target);

  // Forward every monitor event to all connected dashboards.
  monitor.onEvent((event) => {
    if (event.kind === "sample") {
      hub.broadcast({
        kind: "sample",
        targetId: event.targetId,
        sample: event.sample,
      });
    } else {
      hub.broadcast({ kind: "alert", event: event.event });
    }
  });

  const app = express();
  app.use(express.static(join(__dirname, "..", "public")));
  app.get("/health", (_req, res) => res.json({ status: "ok" }));
  app.get("/api/targets", (_req, res) =>
    res.json({ targets: monitor.snapshot(), at: Date.now() }),
  );

  const server = createServer(app);
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (socket) => {
    hub.add(socket);
    // Send an immediate snapshot so the new client renders instantly.
    socket.send(
      JSON.stringify({ kind: "snapshot", targets: monitor.snapshot(), at: Date.now() }),
    );
    socket.on("close", () => hub.remove(socket));
  });

  // Periodic full snapshot keeps aggregates (uptime, percentiles) fresh.
  setInterval(() => {
    hub.broadcast({ kind: "snapshot", targets: monitor.snapshot(), at: Date.now() });
  }, config.snapshotIntervalMs);

  monitor.start();

  server.listen(config.port, () => {
    console.log(`RoviDev realtime monitor on http://localhost:${config.port}`);
  });
}

main();
