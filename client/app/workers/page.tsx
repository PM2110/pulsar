"use client";

import { useEffect, useState, useCallback } from "react";
import { apiService, socket } from "../lib/api.service";
import { Tooltip, Accordion, SearchInput, AnimNum, Checkbox, Dropdown } from "../components/ui";

interface WorkerInfo {
  worker_id: string; queue_name: string; status: "idle" | "processing" | "stopped";
  concurrency: number; active_job_ids: string[]; jobs_processed: number; jobs_failed: number;
  auto_restart: boolean; adaptive_scaling: boolean; restart_at?: string; last_activity: string; started_at: string;
}
const QUEUES = ["notifications", "media", "default"];
const ST: Record<string, { badge: string; dot: string }> = {
  idle: { badge: "badge-completed", dot: "pulse-green" },
  processing: { badge: "badge-processing", dot: "pulse-blue" },
  stopped: { badge: "badge-pending", dot: "pulse-gray" },
};
function ago(iso: string, now: number) { const d = now - new Date(iso).getTime(); if (d < 5000) return "just now"; return d < 60000 ? `${Math.floor(d / 1000)}s ago` : `${Math.floor(d / 60000)}m ago`; }

function WorkerCard({ w, now, onRefresh, onCrash, onStop }: {
  w: WorkerInfo; now: number; onRefresh: () => void; onCrash: (id: string) => void; onStop: (id: string, o?: any) => void;
}) {
  const [menu, setMenu] = useState(false);
  const [crashing, setCrashing] = useState(false);
  const stale = w.status !== "stopped" && (now - new Date(w.last_activity).getTime() > 30000);
  const cfg = ST[w.status] || ST.stopped;
  const rate = w.jobs_processed + w.jobs_failed > 0 ? Math.round((w.jobs_processed / (w.jobs_processed + w.jobs_failed)) * 100) : 100;
  const indicatorColor = stale ? "var(--red)" : w.status === "processing" ? "var(--accent)" : w.status === "idle" ? "var(--green)" : "var(--text-faint)";

  return (
    <div className="worker-card">
      <div className="worker-card-indicator" style={{ background: indicatorColor }} />

      {stale && <div style={{ background: "var(--red-soft)", color: "var(--red)", fontSize: 10, textAlign: "center", padding: "5px 0", fontWeight: 700, borderRadius: "0 8px 0 0", position: "absolute", top: 0, left: 4, right: 0, letterSpacing: ".06em" }}>DISCONNECTED</div>}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, marginTop: stale ? 18 : 0, paddingLeft: 10 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div className={`pulse-dot ${cfg.dot}`} />
            <span style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-.02em" }}>{w.worker_id}</span>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span className="chip" style={{ fontFamily: "monospace" }}>queue:{w.queue_name}</span>
            {w.auto_restart && <Tooltip text="Automatically restarts on crash"><span style={{ fontSize: 10, color: "var(--green)", fontWeight: 700 }}>🛡 AUTO-HEAL</span></Tooltip>}
            {w.adaptive_scaling !== false && <Tooltip text="Adaptive scaling enabled"><span style={{ fontSize: 10, color: "var(--accent)", fontWeight: 700 }}>📊 AUTO-SCALE</span></Tooltip>}
          </div>
        </div>
        <span className={`badge ${stale ? "badge-failed" : cfg.badge}`} style={{ fontSize: "10.5px" }}>{stale ? "OFFLINE" : w.status.toUpperCase()}</span>
      </div>

      {/* Stats grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 18, paddingLeft: 10 }}>
        {[
          { l: "Processed", v: String(w.jobs_processed), c: "var(--green)", tip: "Total successfully processed" },
          { l: "Failed", v: String(w.jobs_failed), c: "var(--red)", tip: "Total failed attempts" },
          { l: "Slots", v: `${w.active_job_ids.length}/${w.concurrency}`, c: "var(--accent)", tip: "Active / total concurrency slots" },
          { l: "Success", v: `${rate}%`, c: rate >= 80 ? "var(--green)" : "var(--red)", tip: "Overall success rate" },
        ].map(s => (
          <Tooltip key={s.l} text={s.tip}>
            <div className="queue-mini" style={{ width: "100%" }}>
              <div className="queue-mini-label">{s.l}</div>
              <div className="queue-mini-val" style={{ color: s.c, fontSize: 18 }}>{s.v}</div>
            </div>
          </Tooltip>
        ))}
      </div>

      {/* Utilization */}
      <div style={{ marginBottom: 16, paddingLeft: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-faint)", marginBottom: 5, fontWeight: 600 }}>
          <span>UTILIZATION</span><span>{w.active_job_ids.length}/{w.concurrency} SLOTS</span>
        </div>
        <div className="capacity-bar">
          {Array.from({ length: w.concurrency }).map((_, i) => (
            <div key={i} className="capacity-seg" style={{ flex: 1, background: i < w.active_job_ids.length ? "var(--accent)" : "var(--border)" }} />
          ))}
        </div>
      </div>

      {/* Settings Toggles */}
      <div style={{ display: "flex", gap: 16, paddingLeft: 10, marginBottom: 16 }}>
        <Checkbox
          checked={w.auto_restart}
          onChange={async (checked) => {
            try {
              await apiService.updateWorkerSettings(w.worker_id, { auto_restart: checked });
              onRefresh();
            } catch {}
          }}
          label={<>🛡️ Auto-Heal</>}
        />
        <Checkbox
          checked={w.adaptive_scaling !== false}
          onChange={async (checked) => {
            try {
              await apiService.updateWorkerSettings(w.worker_id, { adaptive_scaling: checked });
              onRefresh();
            } catch {}
          }}
          label={<>📊 Auto-Scale</>}
        />
      </div>

      {/* Active jobs */}
      {w.active_job_ids.length > 0 && (
        <div style={{ marginBottom: 16, paddingLeft: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>Active Jobs</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {w.active_job_ids.map(id => <span key={id} className="chip" style={{ fontFamily: "monospace", fontSize: 10 }}>{id.substring(0, 8)}</span>)}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 16, borderTop: "1px solid var(--border)", paddingLeft: 10 }}>
        <Tooltip text={`Started: ${new Date(w.started_at).toLocaleString()}`}><span style={{ fontSize: 11, color: "var(--text-faint)" }}>Active {ago(w.last_activity, now)}</span></Tooltip>
        <div style={{ display: "flex", gap: 6 }}>
          {w.status !== "stopped" && !stale ? (<>
            <Tooltip text="Simulate crash for testing"><button className="btn btn-danger" style={{ padding: "5px 12px", fontSize: 11 }} disabled={crashing}
              onClick={async () => { setCrashing(true); try { await onCrash(w.worker_id); onRefresh(); } finally { setCrashing(false); } }}>{crashing ? "..." : "💥 Crash"}</button></Tooltip>
            <div style={{ position: "relative" }}>
              <button className="btn btn-ghost" style={{ padding: "5px 12px", fontSize: 11 }} onClick={() => setMenu(!menu)}>■ Stop</button>
              {menu && (
                <div style={{ position: "absolute", bottom: "100%", right: 0, width: 170, zIndex: 100, marginBottom: 6, background: "var(--bg-card)", border: "1px solid var(--border-strong)", borderRadius: 8, padding: 4, boxShadow: "var(--shadow-lg)" }}>
                  {[{ l: "Manual Stop", fn: () => onStop(w.worker_id) }, { l: "Auto-Restart", fn: () => onStop(w.worker_id, { auto_restart: true }) }, { l: "Restart in 30s", fn: () => onStop(w.worker_id, { restart_in: 30 }) }]
                    .map(m => <button key={m.l} onClick={() => { m.fn(); setMenu(false); onRefresh(); }} style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", padding: "8px 12px", fontSize: 12, color: "var(--text-secondary)", cursor: "pointer", borderRadius: 4, fontFamily: "inherit" }}>{m.l}</button>)}
                </div>
              )}
            </div>
          </>) : (
            <div style={{ display: "flex", gap: 6 }}>
              <button className="btn btn-success" style={{ padding: "5px 14px", fontSize: 11 }} onClick={async () => { try { await apiService.startWorker({ worker_id: w.worker_id, queue_name: w.queue_name }); onRefresh(); } catch {} }}>▶ Start</button>
              <button className="btn btn-danger" style={{ padding: "5px 14px", fontSize: 11 }} onClick={async () => { if (confirm(`Remove worker '${w.worker_id}' from registry?`)) { try { await apiService.deleteWorker(w.worker_id); onRefresh(); } catch {} } }}>🗑 Remove</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function WorkersPage() {
  const [workers, setWorkers] = useState<WorkerInfo[]>([]);
  const [search, setSearch] = useState("");
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

  const filtered = (list: WorkerInfo[]) => search
    ? list.filter(w => w.worker_id.toLowerCase().includes(search.toLowerCase()) || w.queue_name.toLowerCase().includes(search.toLowerCase()))
    : list;

  return (
    <div className="page-wrap">
      <div className="page-header">
        <div>
          <h1 className="page-title">Worker Fleet</h1>
          <p className="page-sub">{active.length} active · {inactive.length} inactive · WebSocket connected</p>
        </div>
        <div className="page-actions">
          <div style={{ width: 240 }}><SearchInput placeholder="Search workers..." value={search} onChange={setSearch} debounceMs={200} /></div>
          <button className="btn btn-ghost" onClick={fetch}>↻ Refresh</button>
        </div>
      </div>

      {/* Fleet Stats */}
      <div className="section">
        <div className="section-label">Fleet Overview</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {[
            { l: "Active Nodes", v: active.length, c: "var(--green)", tip: "Currently running worker instances" },
            { l: "Jobs Processed", v: workers.reduce((a, w) => a + w.jobs_processed, 0), c: "var(--text-primary)", tip: "Total processed across all workers" },
            { l: "System Failures", v: workers.reduce((a, w) => a + w.jobs_failed, 0), c: "var(--red)", tip: "Total failures across fleet" },
          ].map(s => (
            <Tooltip key={s.l} text={s.tip}>
              <div className="hero-stat" style={{ width: "100%" }}>
                <div className="hero-stat-label">{s.l}</div>
                <div className="hero-stat-value" style={{ fontSize: 36, color: s.c }}><AnimNum value={s.v} /></div>
              </div>
            </Tooltip>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24 }}>
        <div>
          {/* Active nodes */}
          <div className="section">
            <div className="section-label">Active Nodes</div>
            <Accordion title="Active Workers" badge={<span className="acc-badge">{filtered(active).length}</span>} defaultOpen>
              {filtered(active).length > 0 ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))", gap: 16 }}>
                  {filtered(active).map(w => <WorkerCard key={w.worker_id} w={w} now={now} onRefresh={fetch} onCrash={id => apiService.crashWorker(id)} onStop={(id, o) => apiService.stopWorker(id, o)} />)}
                </div>
              ) : (
                <div style={{ padding: 50, textAlign: "center", border: "2px dashed var(--border)", borderRadius: "var(--radius)", color: "var(--text-faint)", fontSize: 13 }}>{search ? "No workers match your search" : "No active workers. Deploy from the panel →"}</div>
              )}
            </Accordion>
          </div>

          {/* Inactive */}
          {filtered(inactive).length > 0 && (
            <div className="section">
              <div className="section-label">Inactive Nodes</div>
              <Accordion title="Inactive Workers" badge={<span className="acc-badge">{filtered(inactive).length}</span>}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))", gap: 16 }}>
                  {filtered(inactive).map(w => <WorkerCard key={w.worker_id} w={w} now={now} onRefresh={fetch} onCrash={id => apiService.crashWorker(id)} onStop={(id, o) => apiService.stopWorker(id, o)} />)}
                </div>
              </Accordion>
            </div>
          )}
        </div>

        {/* Control Panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card">
            <div className="card-header"><span className="card-title">Deploy Instance</span></div>
            <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label className="label">Queue</label>
                <Dropdown
                  options={QUEUES.map(q => ({ label: q, value: q }))}
                  value={nw.queue_name}
                  onChange={(v) => setNw(f => ({ ...f, queue_name: v }))}
                />
              </div>
              <div><label className="label">Worker ID</label><input className="input" placeholder="e.g. node-01" value={nw.worker_id} onChange={e => setNw(f => ({ ...f, worker_id: e.target.value }))} /></div>
              <Checkbox
                checked={nw.auto_restart}
                onChange={(checked) => setNw(f => ({ ...f, auto_restart: checked }))}
                label={<span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Auto-healing enabled</span>}
              />
              {msg && <p style={{ fontSize: 11, color: msg.ok ? "var(--green)" : "var(--red)" }}>{msg.text}</p>}
              <button className="btn btn-primary" onClick={handleStart} disabled={starting} style={{ height: 42 }}>{starting ? "Starting..." : "🚀 Deploy Node"}</button>
            </div>
          </div>
          <Accordion title="Load Injector" icon="⚡"><div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input type="range" min={1} max={50} value={seedForm.count} onChange={e => setSeedForm(f => ({ ...f, count: +e.target.value }))} style={{ width: "100%" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-faint)" }}><span>1</span><span>{seedForm.count} jobs</span><span>50</span></div>
            <button className="btn btn-primary" onClick={async () => { setSeeding(true); await apiService.seedJobs(seedForm); setSeeding(false); }} disabled={seeding}>{seeding ? "..." : "⚡ Inject Load"}</button>
          </div></Accordion>
          <Accordion title="Adaptive Scaling" icon="📊"><div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {QUEUES.map(q => { const c = asc[q] || { enabled: false }; return (
              <div key={q} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", opacity: c.enabled ? 1 : .4 }}>
                <span style={{ fontSize: 12, fontFamily: "monospace", color: "var(--text-secondary)" }}>{q}</span>
                <span className={`badge ${c.enabled ? "badge-completed" : "badge-pending"}`} style={{ fontSize: 9 }}>{c.enabled ? "ACTIVE" : "OFF"}</span>
              </div>
            ); })}
          </div></Accordion>
        </div>
      </div>
    </div>
  );
}