"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { apiService, socket } from "../lib/api.service";

interface WorkerInfo {
  worker_id: string;
  queue_name: string;
  status: "idle" | "processing" | "stopped";
  concurrency: number;
  active_job_ids: string[];
  jobs_processed: number;
  jobs_failed: number;
  auto_restart: boolean;
  restart_at?: string;
  last_activity: string;
  started_at: string;
}

const QUEUES = ["notifications", "media", "default"];

const STATUS_CONFIG: Record<string, { label: string; badgeClass: string; pulseClass: string }> = {
  idle: { label: "Idle", badgeClass: "badge-completed", pulseClass: "pulse-green" },
  processing: { label: "Processing", badgeClass: "badge-processing", pulseClass: "pulse-white" },
  stopped: { label: "Stopped", badgeClass: "badge-pending", pulseClass: "pulse-gray" },
};

function timeSince(iso: string, now: number) {
  const diff = now - new Date(iso).getTime();
  if (diff < 5000) return "just now";
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  return `${Math.floor(diff / 60000)}m ago`;
}

function WorkerPod({
  worker,
  onStop,
  onCrash,
  now,
}: {
  worker: WorkerInfo;
  onStop: (id: string, options?: any) => void;
  onCrash: (id: string) => void;
  now: number;
}) {
  const [showStopOptions, setShowStopOptions] = useState(false);
  const [isCrashing, setIsCrashing] = useState(false);
  const isStale = now - new Date(worker.last_activity).getTime() > 40000 && worker.status !== "stopped";
  const cfg = STATUS_CONFIG[worker.status] || STATUS_CONFIG.stopped;

  return (
    <div className={`card ${isStale ? 'stale-warning' : ''}`} style={{ transition: "all 0.3s ease", position: "relative" }}>
      {isStale && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0,
          background: "rgba(248, 113, 113, 0.1)",
          color: "#f87171", fontSize: 10, textAlign: "center",
          padding: "2px 0", fontWeight: 700, borderRadius: "10px 10px 0 0",
          borderBottom: "1px solid rgba(248, 113, 113, 0.2)"
        }}>
          UNRESPONSIVE
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16, marginTop: isStale ? 16 : 0 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <div className={`pulse-dot ${cfg.pulseClass}`} style={{ width: 7, height: 7 }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
              {worker.worker_id}
            </span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <span style={{
              fontSize: 10, fontFamily: "monospace", color: "var(--text-muted)",
              background: "rgba(255,255,255,0.04)", padding: "2px 7px", borderRadius: 4,
            }}>
              queue:{worker.queue_name}
            </span>
            {worker.auto_restart && (
              <span style={{ fontSize: 9, color: "var(--completed)", fontWeight: 600, textTransform: "uppercase" }}>
                Auto-Heal
              </span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
          <span className={`badge ${cfg.badgeClass}`} style={{ fontSize: 10 }}>
            {worker.status}
          </span>
          {worker.restart_at && (
            <span style={{ fontSize: 9, color: "var(--text-muted)" }}>
              Restarts {timeSince(worker.restart_at, now).replace('ago', 'in')}
            </span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
        {[
          { label: "Processed", value: worker.jobs_processed, color: "var(--completed)" },
          { label: "Failed", value: worker.jobs_failed, color: "var(--failed)" },
          { label: "Slots", value: `${worker.active_job_ids.length}/${worker.concurrency}`, color: "var(--processing)" },
        ].map((s) => (
          <div key={s.label} style={{ background: "rgba(255,255,255,0.02)", borderRadius: 8, padding: "8px", border: "1px solid var(--border)", textAlign: "center" }}>
            <div style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 2 }}>{s.label}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Progress */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ height: 4, background: "rgba(255,255,255,0.05)", borderRadius: 2, overflow: "hidden", display: "flex", marginBottom: 8 }}>
          {Array.from({ length: worker.concurrency }).map((_, i) => (
            <div key={i} style={{
              flex: 1, marginRight: i === worker.concurrency - 1 ? 0 : 1,
              background: i < worker.active_job_ids.length ? "var(--processing)" : "rgba(255,255,255,0.08)",
            }} />
          ))}
        </div>
        
        {worker.active_job_ids && worker.active_job_ids.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            {worker.active_job_ids.map(id => (
              <span key={id} style={{ 
                fontSize: 9, fontFamily: "monospace", color: "var(--text-muted)", 
                background: "rgba(255,255,255,0.04)", padding: "2px 6px", borderRadius: 4,
                border: "1px solid rgba(255,255,255,0.08)"
              }}>
                {id.substring(0, 8)}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
          Active {timeSince(worker.last_activity, now)}
        </span>
        <div style={{ display: "flex", gap: 6 }}>
          {worker.status !== "stopped" ? (
            <>
              <button
                className="btn btn-secondary"
                style={{ padding: "4px 8px", fontSize: 10, color: "var(--failed)", opacity: isCrashing ? 0.7 : 1, cursor: isCrashing ? 'wait' : 'pointer' }}
                disabled={isCrashing}
                onClick={async () => {
                  setIsCrashing(true);
                  try {
                    await onCrash(worker.worker_id);
                  } finally {
                    setIsCrashing(false);
                  }
                }}
              >
                {isCrashing ? "Crashing..." : "Crash"}
              </button>
              <div style={{ position: "relative" }}>
                <button className="btn btn-danger" style={{ padding: "4px 10px", fontSize: 10 }} onClick={() => setShowStopOptions(!showStopOptions)}>
                  Stop
                </button>
                {showStopOptions && (
                  <div className="popup-menu" style={{
                    position: "absolute", bottom: "100%", right: 0, width: 150, zIndex: 100, marginBottom: 8,
                    background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 8, padding: 4,
                  }}>
                    <button className="menu-item" onClick={() => onStop(worker.worker_id)}>Manual Stop</button>
                    <button className="menu-item" onClick={() => onStop(worker.worker_id, { auto_restart: true })}>Auto-Restart</button>
                    <button className="menu-item" onClick={() => onStop(worker.worker_id, { restart_in: 30 })}>Restart in 30s</button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <button className="btn btn-success" style={{ padding: "4px 10px", fontSize: 10 }} onClick={() => apiService.startWorker({ worker_id: worker.worker_id, queue_name: worker.queue_name })}>
              Start
            </button>
          )}
        </div>
      </div>
      <style jsx>{`
        .menu-item {
          display: block; width: 100%; text-align: left; background: none; border: none; padding: 6px 10px;
          font-size: 11px; color: var(--text-secondary); cursor: pointer; border-radius: 4px;
        }
        .menu-item:hover { background: rgba(255,255,255,0.05); color: var(--text-primary); }
        .stale-warning { border-color: rgba(248, 113, 113, 0.3) !important; background: rgba(248, 113, 113, 0.02) !important; }
      `}</style>
    </div>
  );
}

export default function WorkersPage() {
  const [workers, setWorkers] = useState<WorkerInfo[]>([]);
  const [newWorker, setNewWorker] = useState({ queue_name: "notifications", worker_id: "api-node-01", auto_restart: true });
  const [starting, setStarting] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [seedForm, setSeedForm] = useState({ count: 5, queue_name: "", failure_mode: "" });
  const [seeding, setSeeding] = useState(false);

  const [autoScaleConfig, setAutoScaleConfig] = useState<Record<string, any>>({});
  const [now, setNow] = useState(Date.now());

  const fetchWorkers = useCallback(async () => {
    try {
      const data = await apiService.getWorkers();
      setWorkers(data.workers || []);
      const scaleData = await apiService.getAutoscalerConfig();
      setAutoScaleConfig(scaleData.config || {});
    } catch { }
  }, []);

  useEffect(() => {
    fetchWorkers();
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(clock);
  }, [fetchWorkers]);

  useEffect(() => {
    const handleUpdate = () => fetchWorkers();
    socket.on("stats_update", handleUpdate);
    socket.on("worker_update", handleUpdate);
    return () => {
      socket.off("stats_update", handleUpdate);
      socket.off("worker_update", handleUpdate);
    };
  }, [fetchWorkers]);

  const handleStart = async () => {
    if (!newWorker.worker_id.trim()) {
      setMsg({ text: "Worker ID is required", ok: false });
      return;
    }
    setStarting(true);
    setMsg(null);
    try {
      const data = await apiService.startWorker(newWorker);
      setMsg({ text: data.message, ok: true });
      setNewWorker(f => ({ ...f, worker_id: "" }));
      setTimeout(fetchWorkers, 500);
    } catch (e: any) {
      setMsg({ text: e.message, ok: false });
    } finally {
      setStarting(false);
    }
  };

  const activeWorkers = workers.filter(w => w.status !== "stopped");
  const stoppedWorkers = workers.filter(w => w.status === "stopped");

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ marginBottom: 28, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
            Worker Fleet
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            {activeWorkers.length} active · {stoppedWorkers.length} dormant · websocket connected
          </p>
        </div>
        <button className="btn btn-secondary" style={{ padding: "8px 16px" }} onClick={fetchWorkers}>Refresh</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20 }}>
        <div>
          {/* Stats Bar */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 24 }}>
            {[
              { label: "Active Nodes", value: activeWorkers.length, color: "var(--completed)" },
              { label: "Jobs Processed", value: workers.reduce((a, w) => a + w.jobs_processed, 0), color: "var(--text-primary)" },
              { label: "System Failures", value: workers.reduce((a, w) => a + w.jobs_failed, 0), color: "var(--failed)" },
            ].map(s => (
              <div key={s.label} className="stat-card">
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</div>
                <div className="stat-value" style={{ fontSize: 24, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Active Fleet */}
          <div style={{ marginBottom: 32 }}>
            <div className="section-header">
              <span className="section-title">Active nodes</span>
            </div>
            {activeWorkers.length > 0 ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
                {activeWorkers.map(w => (
                  <WorkerPod key={w.worker_id} worker={w} now={now} onCrash={(id) => apiService.crashWorker(id)} onStop={(id, opt) => apiService.stopWorker(id, opt)} />
                ))}
              </div>
            ) : (
              <div style={{ padding: 48, textAlign: "center", border: "1.5px dashed var(--border)", borderRadius: 12, color: "var(--text-muted)" }}>
                No active workers detected. Deploy an instance from the right panel.
              </div>
            )}
          </div>

          {/* Dormant Nodes */}
          {stoppedWorkers.length > 0 && (
            <div>
              <div className="section-header">
                <span className="section-title">Dormant nodes</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
                {stoppedWorkers.map(w => (
                  <WorkerPod key={w.worker_id} worker={w} now={now} onCrash={(id) => apiService.crashWorker(id)} onStop={(id, opt) => apiService.stopWorker(id, opt)} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Control Panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card">
            <div className="section-header"><span className="section-title">Deploy Instance</span></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label className="label">Queue</label>
                <select className="select" value={newWorker.queue_name} onChange={e => setNewWorker(f => ({ ...f, queue_name: e.target.value }))}>
                  {QUEUES.map(q => <option key={q} value={q}>{q}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Worker ID</label>
                <input className="input" placeholder="e.g. node-01" value={newWorker.worker_id} onChange={e => setNewWorker(f => ({ ...f, worker_id: e.target.value }))} />
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "4px 0" }}>
                <input type="checkbox" checked={newWorker.auto_restart} onChange={e => setNewWorker(f => ({ ...f, auto_restart: e.target.checked }))} />
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Auto-healing enabled</span>
              </label>
              {msg && <p style={{ fontSize: 11, color: msg.ok ? "var(--completed)" : "var(--failed)" }}>{msg.text}</p>}
              <button className="btn btn-primary" onClick={handleStart} disabled={starting} style={{ height: 40 }}>
                {starting ? "Starting..." : "Deploy Node"}
              </button>
            </div>
          </div>

          <div className="card">
            <div className="section-header"><span className="section-title">Load Injector</span></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input type="range" min={1} max={50} value={seedForm.count} onChange={e => setSeedForm(f => ({ ...f, count: Number(e.target.value) }))} style={{ width: "100%" }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-muted)" }}>
                <span>1</span><span>{seedForm.count} jobs</span><span>50</span>
              </div>
              <button className="btn btn-secondary" onClick={async () => { setSeeding(true); await apiService.seedJobs(seedForm); setSeeding(false); }} disabled={seeding}>
                {seeding ? "Injecting..." : "⚡ Inject Load"}
              </button>
            </div>
          </div>

          <div className="card">
            <div className="section-header"><span className="section-title">Adaptive Scaling</span></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {QUEUES.map(q => {
                const conf = autoScaleConfig[q] || { enabled: false };
                return (
                  <div key={q} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", opacity: conf.enabled ? 1 : 0.5 }}>
                    <span style={{ fontSize: 11, fontFamily: "monospace", color: "var(--text-secondary)" }}>{q}</span>
                    <span style={{ fontSize: 10, color: conf.enabled ? "var(--completed)" : "var(--text-muted)" }}>{conf.enabled ? "ACTIVE" : "OFF"}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}