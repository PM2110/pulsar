"use client";

import { useEffect, useState, useCallback } from "react";
import { apiService, socket } from "../lib/api.service";

interface WorkerInfo {
  worker_id: string;
  queue_name: string;
  status: "idle" | "processing" | "stopped";
  jobs_processed: number;
  jobs_failed: number;
  last_activity: string;
  started_at: string;
  current_job_id: string | null;
}

const QUEUES = ["notifications", "media", "default"];

function timeSince(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 5000) return "just now";
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  return `${Math.floor(diff / 60000)}m ago`;
}

function WorkerPod({
  worker,
  onStop,
}: {
  worker: WorkerInfo;
  onStop: (id: string) => void;
}) {
  return (
    <div className={`worker-pod ${worker.status}`}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <div
              className={`pulse-dot ${worker.status === "processing"
                  ? "pulse-white"
                  : worker.status === "idle"
                    ? "pulse-green"
                    : "pulse-gray"
                }`}
              style={{ width: 7, height: 7 }}
            />
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
              {worker.worker_id}
            </span>
          </div>
          <span
            style={{
              fontSize: 11,
              fontFamily: "monospace",
              color: "var(--text-muted)",
              background: "rgba(255,255,255,0.04)",
              padding: "2px 7px",
              borderRadius: 4,
            }}
          >
            queue:{worker.queue_name}
          </span>
        </div>
        <span
          className={`badge badge-${worker.status === "processing"
              ? "processing"
              : worker.status === "idle"
                ? "completed"
                : "pending"
            }`}
        >
          {worker.status === "processing" && <div className="spinner" style={{ width: 9, height: 9 }} />}
          {worker.status}
        </span>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
        {[
          { label: "Processed", value: worker.jobs_processed, color: "var(--completed)" },
          { label: "Failed", value: worker.jobs_failed, color: "var(--failed)" },
          { label: "Active", value: worker.status === "processing" ? "Yes" : "No", color: worker.status === "processing" ? "var(--processing)" : "var(--text-muted)" },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              background: "rgba(255,255,255,0.03)",
              borderRadius: 7,
              padding: "8px 10px",
              border: "1px solid var(--border)",
            }}
          >
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 2 }}>{s.label}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Current job */}
      {worker.current_job_id && (
        <div
          style={{
            background: "rgba(226,232,240,0.05)",
            border: "1px solid rgba(226,232,240,0.1)",
            borderRadius: 7,
            padding: "8px 10px",
            marginBottom: 12,
            fontSize: 11,
          }}
        >
          <span style={{ color: "var(--text-muted)" }}>Processing: </span>
          <span style={{ fontFamily: "monospace", color: "var(--processing)" }}>
            #{worker.current_job_id}
          </span>
        </div>
      )}

      {/* Footer */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
          Active {timeSince(worker.last_activity)}
        </span>
        {worker.status !== "stopped" && (
          <button
            className="btn btn-danger"
            style={{ padding: "4px 12px", fontSize: 11 }}
            onClick={() => onStop(worker.worker_id)}
          >
            ■ Stop
          </button>
        )}
      </div>
    </div>
  );
}

export default function WorkersPage() {
  const [workers, setWorkers] = useState<WorkerInfo[]>([]);
  const [newWorker, setNewWorker] = useState({ queue_name: "notifications", worker_id: "" });
  const [starting, setStarting] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [seedForm, setSeedForm] = useState({ count: 5, queue_name: "", failure_mode: "" });
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState<string | null>(null);

  const fetchWorkers = useCallback(async () => {
    try {
      const data = await apiService.getWorkers();
      setWorkers(data.workers || []);
    } catch { }
  }, []);

  useEffect(() => { fetchWorkers(); }, [fetchWorkers]);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    const handleUpdate = () => {
      clearTimeout(timeout);
      timeout = setTimeout(fetchWorkers, 500); // Debounce updates
    };
    
    socket.on("job_update", handleUpdate);
    socket.on("stats_update", handleUpdate);
    return () => {
      clearTimeout(timeout);
      socket.off("job_update", handleUpdate);
      socket.off("stats_update", handleUpdate);
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
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
          Workers
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
          {activeWorkers.length} active · {stoppedWorkers.length} stopped · live refreshing via WebSocket
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 20 }}>
        {/* Worker grid */}
        <div>
          {/* Stats summary */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
            {[
              {
                label: "Total workers",
                value: workers.length,
                sub: `${activeWorkers.length} active`,
              },
              {
                label: "Jobs processed",
                value: workers.reduce((a, w) => a + w.jobs_processed, 0),
                sub: "across all workers",
              },
              {
                label: "Jobs failed",
                value: workers.reduce((a, w) => a + w.jobs_failed, 0),
                sub: "across all workers",
              },
            ].map((s) => (
              <div key={s.label} className="stat-card">
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>{s.label}</div>
                <div className="stat-value" style={{ fontSize: 26 }}>{s.value}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{s.sub}</div>
              </div>
            ))}
          </div>

          {/* Active workers */}
          {activeWorkers.length > 0 ? (
            <>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                Active
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14, marginBottom: 20 }}>
                {activeWorkers.map((w) => (
                  <WorkerPod key={w.worker_id} worker={w} onStop={handleStop} />
                ))}
              </div>
            </>
          ) : (
            <div
              className="card"
              style={{
                textAlign: "center",
                padding: 48,
                marginBottom: 20,
                color: "var(--text-muted)",
                fontSize: 13,
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 10 }}>◎</div>
              <div>No active workers</div>
              <div style={{ fontSize: 11, marginTop: 4 }}>Start a worker using the panel on the right</div>
            </div>
          )}

          {/* Stopped workers */}
          {stoppedWorkers.length > 0 && (
            <>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                Stopped
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
                {stoppedWorkers.map((w) => (
                  <WorkerPod key={w.worker_id} worker={w} onStop={handleStop} />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Right panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Start worker */}
          <div className="card">
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 16 }}>
              Start Worker
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label className="label">Queue</label>
                <select
                  className="select"
                  value={newWorker.queue_name}
                  onChange={(e) => setNewWorker((f) => ({ ...f, queue_name: e.target.value }))}
                >
                  {QUEUES.map((q) => <option key={q} value={q}>{q}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Worker ID</label>
                <input
                  className="input"
                  placeholder="e.g. my-worker-1"
                  value={newWorker.worker_id}
                  onChange={(e) => setNewWorker((f) => ({ ...f, worker_id: e.target.value }))}
                  onKeyDown={(e) => e.key === "Enter" && handleStart()}
                />
              </div>
              {msg && (
                <p style={{ fontSize: 12, color: msg.ok ? "var(--completed)" : "var(--failed)" }}>
                  {msg.text}
                </p>
              )}
              <button className="btn btn-success" onClick={handleStart} disabled={starting}>
                {starting ? "Starting…" : "▶ Start Worker"}
              </button>
            </div>
          </div>

          {/* Seed jobs */}
          <div className="card">
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 16 }}>
              Seed Jobs
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label className="label">Count: {seedForm.count}</label>
                <input
                  type="range" min={1} max={50} value={seedForm.count}
                  onChange={(e) => setSeedForm((f) => ({ ...f, count: Number(e.target.value) }))}
                  style={{ width: "100%" }}
                />
              </div>
              <div>
                <label className="label">Queue</label>
                <select
                  className="select"
                  value={seedForm.queue_name}
                  onChange={(e) => setSeedForm((f) => ({ ...f, queue_name: e.target.value }))}
                >
                  <option value="">Random</option>
                  {QUEUES.map((q) => <option key={q} value={q}>{q}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Failure mode</label>
                <select
                  className="select"
                  value={seedForm.failure_mode}
                  onChange={(e) => setSeedForm((f) => ({ ...f, failure_mode: e.target.value }))}
                >
                  <option value="">Random</option>
                  <option value="succeed">Always succeed</option>
                  <option value="fail">Always fail</option>
                  <option value="probably_fail">Probabilistic</option>
                </select>
              </div>
              {seedMsg && (
                <p style={{ fontSize: 12, color: seedMsg.startsWith("✓") ? "var(--completed)" : "var(--failed)" }}>
                  {seedMsg}
                </p>
              )}
              <button className="btn btn-primary" onClick={handleSeed} disabled={seeding}>
                {seeding ? "Seeding…" : `⚡ Seed ${seedForm.count} jobs`}
              </button>
            </div>
          </div>

          {/* Queue legend */}
          <div className="card">
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12 }}>
              Queue Reference
            </div>
            {[
              { q: "notifications", types: ["email_send", "sms_send", "push_notify"] },
              { q: "media", types: ["image_resize", "video_transcode", "thumbnail_gen"] },
              { q: "default", types: ["data_export", "report_generate", "cleanup_task"] },
            ].map(({ q, types }) => (
              <div key={q} style={{ marginBottom: 12 }}>
                <div style={{ fontFamily: "monospace", fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>
                  {q}
                </div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {types.map((t) => (
                    <span
                      key={t}
                      style={{
                        fontSize: 10,
                        background: "rgba(255,255,255,0.04)",
                        color: "var(--text-muted)",
                        border: "1px solid var(--border)",
                        padding: "1px 6px",
                        borderRadius: 4,
                      }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
