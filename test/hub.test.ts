import { describe, expect, it } from "vitest";
import { Hub, type Client } from "../src/hub.js";

function fakeClient(readyState = 1): Client & { received: string[] } {
  const received: string[] = [];
  return { received, readyState, send: (d) => received.push(d) };
}

describe("Hub", () => {
  it("broadcasts to all open clients", () => {
    const hub = new Hub();
    const a = fakeClient();
    const b = fakeClient();
    hub.add(a);
    hub.add(b);
    hub.broadcast({ kind: "alert", event: {
      type: "firing", targetId: "t", ruleId: "r", severity: "critical",
      description: "d", at: 1,
    } });
    expect(a.received).toHaveLength(1);
    expect(b.received).toHaveLength(1);
  });

  it("drops non-open clients", () => {
    const hub = new Hub();
    const closed = fakeClient(3); // CLOSED
    hub.add(closed);
    hub.broadcast({ kind: "snapshot", targets: [], at: 0 });
    expect(closed.received).toHaveLength(0);
    expect(hub.size).toBe(0);
  });

  it("removes a client that throws on send", () => {
    const hub = new Hub();
    const bad: Client = { readyState: 1, send: () => { throw new Error("dead"); } };
    hub.add(bad);
    hub.broadcast({ kind: "snapshot", targets: [], at: 0 });
    expect(hub.size).toBe(0);
  });
});
