import type { ServerMessage } from "./types.js";

/** Minimal client surface (a WebSocket satisfies this structurally). */
export interface Client {
  send(data: string): void;
  readyState?: number;
}

const OPEN = 1;

/**
 * Fan-out hub: keeps a set of connected clients and broadcasts typed messages.
 * Decoupled from `ws` so it can be unit-tested with fake clients.
 */
export class Hub {
  private readonly clients = new Set<Client>();

  add(client: Client): void {
    this.clients.add(client);
  }

  remove(client: Client): void {
    this.clients.delete(client);
  }

  get size(): number {
    return this.clients.size;
  }

  broadcast(message: ServerMessage): void {
    const payload = JSON.stringify(message);
    for (const client of this.clients) {
      if (client.readyState !== undefined && client.readyState !== OPEN) {
        // Drop dead sockets lazily.
        this.clients.delete(client);
        continue;
      }
      try {
        client.send(payload);
      } catch {
        this.clients.delete(client);
      }
    }
  }
}
