"use client";

import { useState } from "react";
import { useWorkers } from "../hooks/useWorkers";
import { WorkerPod } from "../components/WorkerPod";
import { apiService } from "../lib/api.service";

const QUEUES = ["notifications", "media", "default"];

const WorkersPage = () => {
  const { workers, fetchWorkers, autoScaleConfig } = useWorkers();
  const [newWorker, setNewWorker] = useState({ queue_name: "notifications", worker_id: "" });
  const [starting, setStarting] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [seedForm, setSeedForm] = useState({ count: 5, queue_name: "", failure_mode: "" });
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState<string | null>(null);
  const [savingScale, setSavingScale] = useState(false);

  const handleUpdateScale = async (queue: string, config: any) => {
    setSavingScale(true);
    try {
      await apiService.updateAutoscalerConfig({ queue_name: queue, config });
      setTimeout(fetchWorkers, 300);
    } catch {} finally {
      setSavingScale(false);
    }
  };

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
      setNewWorker((f) => ({ ...f, worker_id: "" }));
      setTimeout(fetchWorkers, 500);
    } catch (e: any) {
      setMsg({ text: e.message, ok: false });
    } finally {
      setStarting(false);
    }
  };

  const handleStop = async (workerId: string) => {
    try {
      await apiService.stopWorker(workerId);
      setTimeout(fetchWorkers, 500);
    } catch { }
  };

  const handleSeed = async () => {
    setSeeding(true);
    setSeedMsg(null);
    try {
      const body: Record<string, unknown> = { count: seedForm.count };
      if (seedForm.queue_name) body.queue_name = seedForm.queue_name;
      if (seedForm.failure_mode) body.failure_mode = seedForm.failure_mode;
      const data = await apiService.seedJobs(body);
      setSeedMsg(`✓ Seeded ${data.count} jobs`);
    } catch {
      setSeedMsg("✗ Failed to seed");
    } finally {
      setSeeding(false);
    }
  };

  const activeWorkers = workers.filter((w) => w.status !== "stopped");
  const stoppedWorkers = workers.filter((w) => w.status === "stopped");

  return (
    <div style={{ padding: "28px 32px" }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
          Workers
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
          {activeWorkers.length} active · {stoppedWorkers.length} stopped · live refreshing via WebSocket
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 20 }}>
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
            {[
              { label: "Total workers", value: workers.length, sub: `${activeWorkers.length} active` },
              { label: "Jobs processed", value: workers.reduce((a, w) => a + w.jobs_processed, 0), sub: "across all workers" },
              { label: "Jobs failed", value: workers.reduce((a, w) => a + w.jobs_failed, 0), sub: "across all workers" },
            ].map((s) => (
              <div key={s.label} className="stat-card">
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>{s.label}</div>
                <div className="stat-value" style={{ fontSize: 26 }}>{s.value}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{s.sub}</div>
              </div>
            ))}
          </div>

          {activeWorkers.length > 0 ? (
            <>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>Active</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14, marginBottom: 20 }}>
                {activeWorkers.map((w) => <WorkerPod key={w.worker_id} worker={w} onStop={handleStop} />)}
              </div>
            </>
          ) : (
            <div className="card" style={{ textAlign: "center", padding: 48, marginBottom: 20, color: "var(--text-muted)", fontSize: 13 }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>◎</div>
              <div>No active workers</div>
              <div style={{ fontSize: 11, marginTop: 4 }}>Start a worker using the panel on the right</div>
            </div>
          )}

          {stoppedWorkers.length > 0 && (
            <>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>Stopped</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
                {stoppedWorkers.map((w) => <WorkerPod key={w.worker_id} worker={w} onStop={handleStop} />)}
              </div>
            </>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card">
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 16 }}>Start Worker</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label className="label">Queue</label>
                <select className="select" value={newWorker.queue_name} onChange={(e) => setNewWorker((f) => ({ ...f, queue_name: e.target.value }))}>
                  {QUEUES.map((q) => <option key={q} value={q}>{q}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Worker ID</label>
                <input className="input" placeholder="e.g. my-worker-1" value={newWorker.worker_id} onChange={(e) => setNewWorker((f) => ({ ...f, worker_id: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && handleStart()} />
              </div>
              {msg && <p style={{ fontSize: 12, color: msg.ok ? "var(--completed)" : "var(--failed)" }}>{msg.text}</p>}
              <button className="btn btn-success" onClick={handleStart} disabled={starting}>
                {starting ? "Starting…" : "▶ Start Worker"}
              </button>
            </div>
          </div>

          <div className="card">
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 16 }}>Seed Jobs</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label className="label">Count: {seedForm.count}</label>
                <input type="range" min={1} max={50} value={seedForm.count} onChange={(e) => setSeedForm((f) => ({ ...f, count: Number(e.target.value) }))} style={{ width: "100%" }} />
              </div>
              <div>
                <label className="label">Queue</label>
                <select className="select" value={seedForm.queue_name} onChange={(e) => setSeedForm((f) => ({ ...f, queue_name: e.target.value }))}>
                  <option value="">Random</option>
                  {QUEUES.map((q) => <option key={q} value={q}>{q}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Failure mode</label>
                <select className="select" value={seedForm.failure_mode} onChange={(e) => setSeedForm((f) => ({ ...f, failure_mode: e.target.value }))}>
                  <option value="">Random</option>
                  <option value="succeed">Always succeed</option>
                  <option value="fail">Always fail</option>
                  <option value="probably_fail">Probabilistic</option>
                </select>
              </div>
              {seedMsg && <p style={{ fontSize: 12, color: seedMsg.startsWith("✓") ? "var(--completed)" : "var(--failed)" }}>{seedMsg}</p>}
              <button className="btn btn-primary" onClick={handleSeed} disabled={seeding}>
                {seeding ? "Seeding…" : `⚡ Seed ${seedForm.count} jobs`}
              </button>
            </div>
          </div>

          <div className="card">
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12 }}>Auto-Scaling Settings</div>
            {QUEUES.map(q => {
              const conf = autoScaleConfig[q] || { enabled: false, minWorkers: 1, maxWorkers: 5, threshold: 5 };
              return (
                <div key={q} style={{ marginBottom: 16, background: "rgba(255,255,255,0.02)", padding: 10, borderRadius: 6, border: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, fontFamily: "monospace", color: "var(--text-primary)" }}>{q}</span>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{conf.enabled ? "Active" : "Disabled"}</span>
                      <input type="checkbox" checked={conf.enabled} onChange={(e) => handleUpdateScale(q, { ...conf, enabled: e.target.checked })} disabled={savingScale} />
                    </label>
                  </div>
                  
                  {conf.enabled && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <label style={{ fontSize: 11, color: "var(--text-muted)" }}>Min: {conf.minWorkers}</label>
                        <input type="range" min={0} max={10} value={conf.minWorkers} onChange={(e) => handleUpdateScale(q, { ...conf, minWorkers: Number(e.target.value)})} disabled={savingScale} style={{ width: 100 }} />
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <label style={{ fontSize: 11, color: "var(--text-muted)" }}>Max: {conf.maxWorkers}</label>
                        <input type="range" min={1} max={20} value={conf.maxWorkers} onChange={(e) => handleUpdateScale(q, { ...conf, maxWorkers: Number(e.target.value)})} disabled={savingScale} style={{ width: 100 }} />
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <label style={{ fontSize: 11, color: "var(--text-muted)" }}>Threshold: {conf.threshold} / w</label>
                        <input type="range" min={1} max={50} value={conf.threshold} onChange={(e) => handleUpdateScale(q, { ...conf, threshold: Number(e.target.value)})} disabled={savingScale} style={{ width: 100 }} />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="card">
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12 }}>Queue Reference</div>
            {[
              { q: "notifications", types: ["email_send", "sms_send", "push_notify"] },
              { q: "media", types: ["image_resize", "video_transcode", "thumbnail_gen"] },
              { q: "default", types: ["data_export", "report_generate", "cleanup_task"] },
            ].map(({ q, types }) => (
              <div key={q} style={{ marginBottom: 12 }}>
                <div style={{ fontFamily: "monospace", fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>{q}</div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {types.map((t) => (
                    <span key={t} style={{ fontSize: 10, background: "rgba(255,255,255,0.04)", color: "var(--text-muted)", border: "1px solid var(--border)", padding: "1px 6px", borderRadius: 4 }}>{t}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkersPage;
