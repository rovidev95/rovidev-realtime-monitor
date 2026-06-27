// Live dashboard client. Connects over WebSocket and renders snapshots,
// per-check samples (sparklines) and an alert feed.

const grid = document.getElementById("grid");
const alertsEl = document.getElementById("alerts");
const conn = document.getElementById("conn");
const connText = document.getElementById("conn-text");

const state = new Map(); // targetId -> { snapshot, samples: [] }
const MAX_SPARK = 30;

function wsUrl() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${location.host}/ws`;
}

function setConn(online) {
  conn.classList.toggle("online", online);
  conn.classList.toggle("offline", !online);
  connText.textContent = online ? "live" : "reconnecting…";
}

function fmtMs(v) {
  return v ? `${Math.round(v)}ms` : "—";
}
function fmtPct(v) {
  return `${(v * 100).toFixed(1)}%`;
}

function render() {
  grid.innerHTML = "";
  for (const { snapshot, samples } of state.values()) {
    if (!snapshot) continue;
    const t = snapshot.target;
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="head">
        <span class="name">${t.name}</span>
        <span class="badge ${snapshot.status}">${snapshot.status}</span>
      </div>
      <div class="url">${t.url}</div>
      <div class="metrics">
        <div class="metric"><div class="v">${fmtPct(snapshot.uptime)}</div><div class="l">uptime</div></div>
        <div class="metric"><div class="v">${fmtMs(snapshot.latencyP50)}</div><div class="l">p50</div></div>
        <div class="metric"><div class="v">${fmtMs(snapshot.latencyP95)}</div><div class="l">p95</div></div>
      </div>
      <div class="spark">${sparkBars(samples)}</div>
    `;
    grid.appendChild(card);
  }
}

function sparkBars(samples) {
  if (!samples.length) return "";
  const max = Math.max(...samples.map((s) => s.latencyMs), 1);
  return samples
    .map((s) => {
      const h = s.ok ? Math.max(8, (s.latencyMs / max) * 100) : 100;
      return `<div class="bar ${s.ok ? "" : "bad"}" style="height:${h}%"></div>`;
    })
    .join("");
}

function addAlert(event) {
  const empty = alertsEl.querySelector(".empty");
  if (empty) empty.remove();
  const li = document.createElement("li");
  li.className = `alert ${event.type} ${event.severity}`;
  const when = new Date(event.at).toLocaleTimeString();
  li.innerHTML = `
    <div>${event.type === "firing" ? "🔴" : "🟢"} <strong>${event.description}</strong></div>
    <div class="meta">${event.targetId} · ${event.type} · ${when}</div>
  `;
  alertsEl.prepend(li);
  while (alertsEl.children.length > 30) alertsEl.lastChild.remove();
}

function ensure(targetId) {
  if (!state.has(targetId)) state.set(targetId, { snapshot: null, samples: [] });
  return state.get(targetId);
}

function handle(msg) {
  if (msg.kind === "snapshot") {
    for (const snap of msg.targets) {
      const e = ensure(snap.target.id);
      e.snapshot = snap;
    }
    render();
  } else if (msg.kind === "sample") {
    const e = ensure(msg.targetId);
    e.samples.push(msg.sample);
    if (e.samples.length > MAX_SPARK) e.samples.shift();
    render();
  } else if (msg.kind === "alert") {
    addAlert(msg.event);
  }
}

function connect() {
  const ws = new WebSocket(wsUrl());
  ws.onopen = () => setConn(true);
  ws.onclose = () => {
    setConn(false);
    setTimeout(connect, 2000);
  };
  ws.onerror = () => ws.close();
  ws.onmessage = (ev) => {
    try {
      handle(JSON.parse(ev.data));
    } catch (err) {
      console.error("bad message", err);
    }
  };
}

alertsEl.innerHTML = '<li class="empty">No alerts yet. All systems nominal.</li>';
connect();
