"use client";

import { useEffect, useState, useCallback } from "react";
import { apiService, socket } from "../lib/api.service";
import { Acc, Tip } from "../components/Accordion";
import { useTheme } from "../components/ThemeProvider";

interface WorkerInfo {
  worker_id: string; queue_name: string; status: "idle" | "processing" | "stopped";
  concurrency: number; active_job_ids: string[]; jobs_processed: number; jobs_failed: number;
  auto_restart: boolean; restart_at?: string; last_activity: string; started_at: string;
}

const QUEUES = ["notifications", "media", "default"];
const ST: Record<string, { badge: string; pulse: string }> = {
  idle: { badge: "badge-completed", pulse: "pulse-green" },
  processing: { badge: "badge-processing", pulse: "pulse-white" },
  stopped: { badge: "badge-pending", pulse: "pulse-gray" },
};

function ago(iso: string, now: number) {
  const d = now - new Date(iso).getTime();
  if (d < 5000) return "just now";
  return d < 60000 ? `${Math.floor(d / 1000)}s ago` : `${Math.floor(d / 60000)}m ago`;
}

function WCard({ w, onStop, onCrash, onRefresh, now }: {
  w: WorkerInfo; onStop: (id: string, o?: any) => void; onCrash: (id: string) => void; onRefresh: () => void; now: number;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [crashing, setCrashing] = useState(false);
  const stale = w.status !== "stopped" && (now - new Date(w.last_activity).getTime() > 30000);
  const cfg = ST[w.status] || ST.stopped;
  const rate = w.jobs_processed + w.jobs_failed > 0 ? Math.round((w.jobs_processed / (w.jobs_processed + w.jobs_failed)) * 100) : 100;

  return (
    <div className="worker-pod" style={{ position: "relative", borderLeftColor: stale ? "var(--red)" : w.status === "processing" ? "var(--accent)" : "var(--border)", borderLeftWidth: 3 }}>
      {stale && <div style={{ position: "absolute", top: 0, left: -1, right: 0, background: "var(--red-soft)", color: "var(--red)", fontSize: 9, textAlign: "center", padding: "4px 0", fontWeight: 700, borderRadius: "0 10px 0 0", letterSpacing: "0.06em" }}>DISCONNECTED</div>}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18, marginTop: stale ? 14 : 0 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <div className={`pulse-dot ${cfg.pulse}`} />
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{w.worker_id}</span>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span className="chip" style={{ fontFamily: "monospace" }}>queue:{w.queue_name}</span>
            {w.auto_restart && <Tip text="Auto-restarts on crash"><span style={{ fontSize: 9, color: "var(--green)", fontWeight: 700 }}>🛡 HEAL</span></Tip>}
          </div>
        </div>
        <span className={`badge ${stale ? "badge-failed" : cfg.badge}`}>{stale ? "OFFLINE" : w.status}</span>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
        {[
          { l: "Processed", v: String(w.jobs_processed), c: "var(--green)", tip: "Total completed" },
          { l: "Failed", v: String(w.jobs_failed), c: "var(--red)", tip: "Total failed" },
          { l: "Slots", v: `${w.active_job_ids.length}/${w.concurrency}`, c: "var(--accent)", tip: "Active / capacity" },
          { l: "Success", v: `${rate}%`, c: rate >= 80 ? "var(--green)" : "var(--red)", tip: "Success rate" },
        ].map(s => (
          <Tip key={s.l} text={s.tip}>
            <div className="queue-mini-stat" style={{ width: "100%" }}>
              <div className="queue-mini-stat-label">{s.l}</div>
              <div className="queue-mini-stat-value" style={{ color: s.c, fontSize: 16 }}>{s.v}</div>
            </div>
          </Tip>
        ))}
      </div>

      {/* Concurrency */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-faint)", marginBottom: 4 }}>
          <span>Utilization</span><span>{w.active_job_ids.length}/{w.concurrency}</span>
        </div>
        <div className="queue-bar">
          {Array.from({ length: w.concurrency }).map((_, i) => (
            <div key={i} className="queue-bar-seg" style={{ flex: 1, background: i < w.active_job_ids.length ? "var(--accent)" : "var(--border)" }} />
          ))}
        </div>
      </div>

      {/* Active jobs */}
      {w.active_job_ids.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Active Jobs</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {w.active_job_ids.map(id => <span key={id} className="chip" style={{ fontFamily: "monospace", fontSize: 10 }}>{id.substring(0, 8)}</span>)}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 14, borderTop: "1px solid var(--border)" }}>
        <Tip text={`Started: ${new Date(w.started_at).toLocaleString()}`}><span style={{ fontSize: 11, color: "var(--text-faint)" }}>Active {ago(w.last_activity, now)}</span></Tip>
        <div style={{ display: "flex", gap: 6 }}>
          {w.status !== "stopped" && !stale ? (<>
            <button className="btn btn-danger" style={{ padding: "4px 10px", fontSize: 10 }} disabled={crashing}
              onClick={async () => { setCrashing(true); try { await onCrash(w.worker_id); onRefresh(); } finally { setCrashing(false); } }}>
              {crashing ? "..." : "💥 Crash"}
            </button>
            <div style={{ position: "relative" }}>
              <button className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: 10 }} onClick={() => setShowMenu(!showMenu)}>■ Stop</button>
              {showMenu && (
                <div style={{ position: "absolute", bottom: "100%", right: 0, width: 155, zIndex: 100, marginBottom: 6, background: "var(--bg-card)", border: "1px solid var(--border-strong)", borderRadius: "var(--radius)", padding: 3, boxShadow: "var(--shadow-lg)" }}>
                  {[
                    { label: "Manual Stop", fn: () => onStop(w.worker_id) },
                    { label: "Auto-Restart", fn: () => onStop(w.worker_id, { auto_restart: true }) },
                    { label: "Restart in 30s", fn: () => onStop(w.worker_id, { restart_in: 30 }) },
                  ].map(m => (
                    <button key={m.label} onClick={() => { m.fn(); setShowMenu(false); onRefresh(); }}
                      style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", padding: "7px 10px", fontSize: 11, color: "var(--text-secondary)", cursor: "pointer", borderRadius: "var(--radius-xs)" }}>{m.label}</button>
                  ))}
                </div>
              )}
            </div>
          </>) : (
            <button className="btn btn-success" style={{ padding: "4px 12px", fontSize: 10 }}
              onClick={() => apiService.startWorker({ worker_id: w.worker_id, queue_name: w.queue_name })}>▶ Start</button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function WorkersPage() {
  const { theme, toggleTheme } = useTheme();
  const [workers, setWorkers] = useState<WorkerInfo[]>([]);
  const [nw, setNw] = useState({ queue_name: "notifications", worker_id: "api-node-01", auto_restart: true });
  const [starting, setStarting] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [seedForm, setSeedForm] = useState({ count: 5, queue_name: "", failure_mode: "" });
  const [seeding, setSeeding] = useState(false);
  const [asc, setAsc] = useState<Record<string, any>>({});
  const [now, setNow] = useState(Date.now());

  const fetch = useCallback(async () => {
    try { const d = await apiService.getWorkers(); setWorkers(d.workers || []); const s = await apiService.getAutoscalerConfig(); setAsc(s.config || {}); } catch {}
  }, []);
  useEffect(() => { fetch(); const c = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(c); }, [fetch]);
  useEffect(() => { const h = () => fetch(); socket.on("stats_update", h); socket.on("worker_update", h); return () => { socket.off("stats_update", h); socket.off("worker_update", h); }; }, [fetch]);

  const handleStart = async () => {
    if (!nw.worker_id.trim()) { setMsg({ text: "Worker ID required", ok: false }); return; }
    setStarting(true); setMsg(null);
    try { const d = await apiService.startWorker(nw); setMsg({ text: d.message, ok: true }); setNw(f => ({ ...f, worker_id: "" })); setTimeout(fetch, 500); }
    catch (e: any) { setMsg({ text: e.message, ok: false }); } finally { setStarting(false); }
  };

  const active = workers.filter(w => w.status !== "stopped" && (now - new Date(w.last_activity).getTime() < 30000));
  const inactive = workers.filter(w => w.status === "stopped" || (now - new Date(w.last_activity).getTime() >= 30000));

  return (
    <div className="page">
      {/* ─── Header ─── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
        <div>
          <h1 className="page-title">Worker Fleet</h1>
          <p className="page-sub">{active.length} active · {inactive.length} inactive · websocket connected</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost" onClick={fetch}>↻ Refresh</button>
          <button className="theme-toggle" onClick={toggleTheme}>{theme === "dark" ? "☀️" : "🌙"}</button>
        </div>
      </div>

      {/* ─── ROW 1: Fleet Stats ─── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 24 }}>
        {[
          { l: "Active Nodes", v: active.length, c: "var(--green)", tip: "Currently running instances" },
          { l: "Jobs Processed", v: workers.reduce((a, w) => a + w.jobs_processed, 0), c: "var(--text-primary)", tip: "Total across fleet" },
          { l: "System Failures", v: workers.reduce((a, w) => a + w.jobs_failed, 0), c: "var(--red)", tip: "Total failures across fleet" },
        ].map(s => (
          <Tip key={s.l} text={s.tip}>
            <div className="stat-card" style={{ width: "100%" }}>
              <div className="stat-card-label">{s.l}</div>
              <div className="stat-value" style={{ fontSize: 26, color: s.c }}>{s.v}</div>
            </div>
          </Tip>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20 }}>
        <div>
          {/* ─── ROW 2: Active Nodes ─── */}
          <div style={{ marginBottom: 24 }}>
            <Acc title="Active Nodes" badge={<span className="acc-badge">{active.length}</span>} open={true}>
              {active.length > 0 ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 14 }}>
                  {active.map(w => <WCard key={w.worker_id} w={w} now={now} onRefresh={fetch} onCrash={id => apiService.crashWorker(id)} onStop={(id, o) => apiService.stopWorker(id, o)} />)}
                </div>
              ) : (
                <div style={{ padding: 40, textAlign: "center", border: "1.5px dashed var(--border)", borderRadius: "var(--radius-lg)", color: "var(--text-faint)" }}>No active workers. Deploy from the panel →</div>
              )}
            </Acc>
          </div>

          {/* ─── ROW 3: Inactive Nodes ─── */}
          {inactive.length > 0 && (
            <Acc title="Inactive Nodes" badge={<span className="acc-badge">{inactive.length}</span>}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 14 }}>
                {inactive.map(w => <WCard key={w.worker_id} w={w} now={now} onRefresh={fetch} onCrash={id => apiService.crashWorker(id)} onStop={(id, o) => apiService.stopWorker(id, o)} />)}
              </div>
            </Acc>
          )}
        </div>

        {/* ─── Sidebar: Controls ─── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Deploy */}
          <div className="card">
            <div className="section-header"><span className="section-title">Deploy Instance</span></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div><label className="label">Queue</label><select className="select" value={nw.queue_name} onChange={e => setNw(f => ({ ...f, queue_name: e.target.value }))}>{QUEUES.map(q => <option key={q} value={q}>{q}</option>)}</select></div>
              <div><label className="label">Worker ID</label><input className="input" placeholder="e.g. node-01" value={nw.worker_id} onChange={e => setNw(f => ({ ...f, worker_id: e.target.value }))} /></div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input type="checkbox" checked={nw.auto_restart} onChange={e => setNw(f => ({ ...f, auto_restart: e.target.checked }))} />
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Auto-healing</span>
              </label>
              {msg && <p style={{ fontSize: 11, color: msg.ok ? "var(--green)" : "var(--red)" }}>{msg.text}</p>}
              <button className="btn btn-primary" onClick={handleStart} disabled={starting} style={{ height: 38 }}>{starting ? "Starting..." : "🚀 Deploy Node"}</button>
            </div>
          </div>

          {/* Load Injector */}
          <Acc title="Load Injector" icon="⚡">
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <input type="range" min={1} max={50} value={seedForm.count} onChange={e => setSeedForm(f => ({ ...f, count: +e.target.value }))} style={{ width: "100%" }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-faint)" }}><span>1</span><span>{seedForm.count} jobs</span><span>50</span></div>
              <button className="btn btn-secondary" onClick={async () => { setSeeding(true); await apiService.seedJobs(seedForm); setSeeding(false); }} disabled={seeding}>{seeding ? "Injecting..." : "⚡ Inject Load"}</button>
            </div>
          </Acc>

          {/* Scaling */}
          <Acc title="Adaptive Scaling" icon="📊">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {QUEUES.map(q => {
                const c = asc[q] || { enabled: false };
                return (
                  <div key={q} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", opacity: c.enabled ? 1 : 0.45 }}>
                    <span style={{ fontSize: 12, fontFamily: "monospace", color: "var(--text-secondary)" }}>{q}</span>
                    <span className={`badge ${c.enabled ? "badge-completed" : "badge-pending"}`} style={{ fontSize: 9 }}>{c.enabled ? "ACTIVE" : "OFF"}</span>
                  </div>
                );
              })}
            </div>
          </Acc>
        </div>
      </div>
    </div>
  );
}