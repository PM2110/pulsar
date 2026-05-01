"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { apiService, socket } from "./lib/api.service";

interface Stats {
  jobs: {
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  };
  outbox: {
    total: number;
    pending: number;
    processed: number;
    failed: number;
  };
  queues: {
    depths: Record<string, number>;
    delayed: Record<string, number>;
    readyJobs: Record<string, { id: string; runAt: number }[]>;
    delayedJobs: Record<string, { id: string; runAt: number }[]>;
    processing: Record<string, { id: string; workerId: string | null; workerHostname: string | null }[]>;
  };
  attempts: {
    total: number;
    successful: number;
    failed: number;
    avg_execution_ms: number;
    avg_latency_ms: number;
  };
  throughput_last_60s: number;
}

interface FeedEvent {
  type: string;
  job_id: string;
  job_type: string;
  queue_name: string;
  status: string;
  prev_status: string;
  attempts: number;
  max_attempts: number;
  error: string | null;
  timestamp: string;
}

interface SeedFormState {
  count: number;
  queue_name: string;
  failure_mode: string;
}

const STATUS_CONFIG: Record<string, { label: string; badgeClass: string; pulseClass: string }> = {
  pending: { label: "Pending", badgeClass: "badge-pending", pulseClass: "pulse-gray" },
  processing: { label: "Processing", badgeClass: "badge-processing", pulseClass: "pulse-white" },
  completed: { label: "Completed", badgeClass: "badge-completed", pulseClass: "pulse-green" },
  failed: { label: "Failed", badgeClass: "badge-failed", pulseClass: "pulse-red" },
};

const QUEUES = ["notifications", "media", "default"];
const QUEUE_COLORS: Record<string, string> = {
  notifications: "rgba(255,255,255,0.45)",
  media: "rgba(255,255,255,0.25)",
  default: "rgba(255,255,255,0.12)",
};

function AnimatedCounter({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);

  useEffect(() => {
    const start = prev.current;
    const end = value;
    if (start === end) return;
    const diff = end - start;
    const duration = 400;
    const steps = 20;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      setDisplay(Math.round(start + diff * (step / steps)));
      if (step >= steps) {
        clearInterval(timer);
        prev.current = end;
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [value]);

  return <span>{display.toLocaleString()}</span>;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [feed, setFeed] = useState<FeedEvent[]>([]);
  const [seeding, setSeeding] = useState(false);
  const [seedForm, setSeedForm] = useState<SeedFormState>({
    count: 10,
    queue_name: "",
    failure_mode: "",
  });
  const [seedMsg, setSeedMsg] = useState<string | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  // Live clock — ticks every second so all time displays update without refetching
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const data = await apiService.getStats();
      setStats(data);
    } catch { }
  }, []);

  // Fetch initially, then rely on WebSocket for live updates
  useEffect(() => {
    fetchStats();
    
    socket.on("stats_update", (data: Stats) => {
      setStats(data);
    });

    return () => {
      socket.off("stats_update");
    };
  }, [fetchStats]);

  // WebSocket feed
  useEffect(() => {
    const handleJobUpdate = (ev: FeedEvent) => {
      // Set timestamp dynamically since worker might just pass basic data
      const eventWithTime: FeedEvent = {
        ...ev,
        timestamp: ev.timestamp || new Date().toISOString()
      };
      
      setFeed((prev) => {
        const next = [eventWithTime, ...prev].slice(0, 60);
        return next;
      });
      setTimeout(() => {
        feedRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      }, 50);
    };

    socket.on("job_update", handleJobUpdate);
    return () => {
      socket.off("job_update", handleJobUpdate);
    };
  }, []);

  const handleSeed = async () => {
    setSeeding(true);
    setSeedMsg(null);
    try {
      const body: Record<string, unknown> = { count: seedForm.count };
      if (seedForm.queue_name) body.queue_name = seedForm.queue_name;
      if (seedForm.failure_mode) body.failure_mode = seedForm.failure_mode;
      const data = await apiService.seedJobs(body);
      setSeedMsg(`✓ Seeded ${data.count} jobs successfully`);
      fetchStats();
    } catch {
      setSeedMsg("✗ Failed to seed jobs");
    } finally {
      setSeeding(false);
    }
  };

  const total = stats?.jobs.total || 0;
  const statItems = [
    { label: "Pending", value: stats?.jobs.pending ?? 0, color: "var(--pending)", dot: "pulse-gray" },
    { label: "Processing", value: stats?.jobs.processing ?? 0, color: "var(--processing)", dot: "pulse-white" },
    { label: "Completed", value: stats?.jobs.completed ?? 0, color: "#4ade80", dot: "pulse-green" },
    { label: "Failed", value: stats?.jobs.failed ?? 0, color: "#f87171", dot: "pulse-red" },
  ];



  return (
    <div style={{ padding: "28px 32px", maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
          Dashboard
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
          Live overview of job processing, queue health, and throughput
        </p>
      </div>

      {/* Stat Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
        {statItems.map((s) => (
          <div key={s.label} className="stat-card">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <div className={`pulse-dot ${s.dot}`} style={{ width: 7, height: 7 }} />
              <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>{s.label}</span>
            </div>
            <div className="stat-value" style={{ color: s.color }}>
              <AnimatedCounter value={s.value} />
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-muted)" }}>
              {total > 0 ? Math.round((s.value / total) * 100) : 0}% of total
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
        {/* Job distribution bar */}
        <div className="card">
          <div className="section-header">
            <span className="section-title">Job Distribution</span>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{total} total</span>
          </div>
          <div
            style={{
              height: 10,
              borderRadius: 999,
              overflow: "hidden",
              background: "rgba(255,255,255,0.05)",
              display: "flex",
              marginBottom: 14,
            }}
          >
            {statItems.map((s) => (
              <div
                key={s.label}
                style={{
                  width: `${total > 0 ? (s.value / total) * 100 : 0}%`,
                  background: s.color,
                  transition: "width 0.5s ease",
                }}
              />
            ))}
          </div>
          <div style={{ display: "flex", gap: 18 }}>
            {statItems.map((s) => (
              <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} />
                <span style={{ color: "var(--text-muted)" }}>{s.label}</span>
                <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Performance metrics */}
        <div className="card">
          <div className="section-header">
            <span className="section-title">Performance</span>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>rolling avg</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[
              { label: "Throughput / 60s", value: stats?.throughput_last_60s ?? 0, unit: "jobs", highlight: true },
              { label: "Avg Execution", value: stats?.attempts.avg_execution_ms ?? 0, unit: "ms" },
              { label: "Avg Queue Latency", value: stats?.attempts.avg_latency_ms ?? 0, unit: "ms" },
              { label: "Total Attempts", value: stats?.attempts.total ?? 0, unit: "" },
            ].map((m) => (
              <div
                key={m.label}
                style={{
                  background: "rgba(255,255,255,0.03)",
                  borderRadius: 8,
                  padding: "12px 14px",
                  border: "1px solid var(--border)",
                }}
              >
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>{m.label}</div>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: m.highlight ? "var(--completed)" : "var(--text-primary)",
                  }}
                >
                  <AnimatedCounter value={Math.round(m.value)} />
                  {m.unit && <span style={{ fontSize: 12, fontWeight: 400, marginLeft: 3, color: "var(--text-muted)" }}>{m.unit}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 
            Outbox Relay Pipeline 
            Displays the status of the Transactional Outbox.
            This represents the intermediate step between DB job creation and Redis enqueuing.
        */}
        <div className="card">
          <div className="section-header">
            <span className="section-title">Outbox Relay Pipeline</span>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{stats?.outbox.total || 0} total events</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            {[
              { label: "Pipeline Pending", value: stats?.outbox.pending ?? 0, color: "var(--text-secondary)" },
              { label: "Relayed Success", value: stats?.outbox.processed ?? 0, color: "var(--completed)" },
              { label: "Relay Failed", value: stats?.outbox.failed ?? 0, color: "var(--failed)" },
            ].map((m) => (
              <div
                key={m.label}
                style={{
                  background: "rgba(255,255,255,0.03)",
                  borderRadius: 8,
                  padding: "12px 14px",
                  border: "1px solid var(--border)",
                }}
              >
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>{m.label}</div>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: m.color,
                  }}
                >
                  <AnimatedCounter value={m.value} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, fontSize: 11, color: "var(--text-faint)", fontStyle: "italic" }}>
            Ensures atomic job creation between DB and Redis
          </div>
        </div>
      </div>

      {/* Queue Lanes — full width */}
      <div style={{ marginBottom: 16 }}>
        {/* Queue Lanes */}
        <div className="card">
          <div className="section-header">
            <span className="section-title">Queue Lanes</span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>live · pending / processing / delayed</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {QUEUES.map((q) => {
              const depth = stats?.queues.depths[q] ?? 0;
              const delayed = stats?.queues.delayed[q] ?? 0;
              const processingJobs = stats?.queues.processing[q] ?? [];
              const readyItems = stats?.queues.readyJobs[q] ?? [];
              const delayedItems = stats?.queues.delayedJobs[q] ?? [];

              const pendingOverflow = Math.max(0, depth - readyItems.length);
              const delayedOverflow = Math.max(0, delayed - delayedItems.length);
              const hasAnything = depth > 0 || delayed > 0 || processingJobs.length > 0;

              // Helper: format a short worker label from workerId / hostname
              const workerLabel = (workerId: string | null, hostname: string | null): string => {
                if (workerId) {
                  // e.g. "notifications-worker" -> strip queue prefix -> "worker"
                  // use last segment after last dash-number or just shorten
                  return workerId.replace(/-worker$/, '').replace('notifications', 'notif').slice(0, 10);
                }
                if (hostname) return hostname.slice(0, 6);
                return 'worker';
              };

              // Format wait time for ready jobs (how long they've been in the queue)
              const waitLabel = (runAt: number): string => {
                const secs = Math.max(0, Math.round((now - runAt) / 1000));
                if (secs >= 60) return `${Math.floor(secs / 60)}m ${secs % 60}s`;
                return `${secs}s`;
              };

              // Format countdown for delayed jobs
              const delayLabel = (runAt: number): string => {
                const secs = Math.max(0, Math.round((runAt - now) / 1000));
                if (secs >= 60) return `in ${Math.floor(secs / 60)}m ${secs % 60}s`;
                return `in ${secs}s`;
              };
              return (
                <div key={q}>
                  {/* Queue header */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <span style={{ fontSize: 12, fontFamily: "monospace", fontWeight: 700, color: "var(--text-secondary)" }}>
                      queue:{q}
                    </span>
                    <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
                    <div style={{ display: "flex", gap: 10, fontSize: 11 }}>
                      {processingJobs.length > 0 && <span style={{ color: "rgba(74,222,128,0.8)" }}>{processingJobs.length} processing</span>}
                      {depth > 0 && <span style={{ color: "var(--text-muted)" }}>{depth} ready</span>}
                      {delayed > 0 && <span style={{ color: "rgba(248,113,113,0.85)" }}>{delayed} delayed</span>}
                      {!hasAnything && <span style={{ color: "var(--text-faint)" }}>idle</span>}
                    </div>
                  </div>

                  {/* Main queue cells */}
                  {hasAnything && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {/* Active + Ready queue */}
                      {(processingJobs.length > 0 || readyItems.length > 0) && (
                        <div>
                          <div style={{ fontSize: 10, color: "var(--text-faint)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Ready Queue</div>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {/* Processing cells — green with worker label */}
                            {processingJobs.map((job) => (
                              <div
                                key={`proc-${job.id}`}
                                title={`Processing job #${job.id} · ${job.workerId ?? 'worker'} (${job.workerHostname ?? ''})`}
                                style={{
                                  padding: "6px 10px",
                                  borderRadius: 6,
                                  background: "rgba(74,222,128,0.08)",
                                  border: "1px solid rgba(74,222,128,0.3)",
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: 2,
                                  minWidth: 80,
                                  animation: "soft-blink 2s ease-in-out infinite",
                                }}
                              >
                                <span style={{ fontSize: 9, color: "rgba(74,222,128,0.6)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                  {workerLabel(job.workerId, job.workerHostname)}
                                </span>
                                <span style={{ fontSize: 12, fontFamily: "monospace", fontWeight: 600, color: "rgba(74,222,128,0.9)" }}>#{job.id}</span>
                              </div>
                            ))}

                            {/* Ready/Pending cells — neutral with wait time */}
                            {readyItems.map((item, i) => (
                              <div
                                key={`ready-${item.id}-${i}`}
                                title={`Pending job #${item.id} · waiting since ${new Date(item.runAt).toLocaleTimeString()}`}
                                style={{
                                  padding: "6px 10px",
                                  borderRadius: 6,
                                  background: "rgba(255,255,255,0.03)",
                                  border: "1px solid var(--border-strong)",
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: 2,
                                  minWidth: 80,
                                }}
                              >
                                <span style={{ fontSize: 9, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>wait {waitLabel(item.runAt)}</span>
                                <span style={{ fontSize: 12, fontFamily: "monospace", fontWeight: 600, color: "var(--text-secondary)" }}>#{item.id}</span>
                              </div>
                            ))}

                            {/* Overflow badge */}
                            {pendingOverflow > 0 && (
                              <div style={{
                                padding: "6px 10px",
                                borderRadius: 6,
                                background: "rgba(255,255,255,0.02)",
                                border: "1px dashed var(--border)",
                                display: "flex",
                                alignItems: "center",
                                fontSize: 11,
                                color: "var(--text-faint)",
                                minWidth: 60,
                              }}>
                                +{pendingOverflow} more
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Delayed queue */}
                      {delayedItems.length > 0 && (
                        <div>
                          <div style={{ fontSize: 10, color: "var(--text-faint)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Delayed Queue</div>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {delayedItems.map((item, i) => (
                              <div
                                key={`del-${item.id}-${i}`}
                                title={`Job #${item.id} — runs at ${new Date(item.runAt).toLocaleTimeString()}`}
                                style={{
                                  padding: "6px 10px",
                                  borderRadius: 6,
                                  background: "rgba(248,113,113,0.06)",
                                  border: "1px solid rgba(248,113,113,0.25)",
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: 2,
                                  minWidth: 80,
                                }}
                              >
                                <span style={{ fontSize: 9, color: "rgba(248,113,113,0.55)", textTransform: "uppercase", letterSpacing: "0.05em" }}>delayed</span>
                                <span style={{ fontSize: 12, fontFamily: "monospace", fontWeight: 600, color: "rgba(248,113,113,0.8)" }}>#{item.id}</span>
                                <span style={{ fontSize: 9, color: "rgba(248,113,113,0.5)" }}>{delayLabel(item.runAt)}</span>
                              </div>
                            ))}
                            {delayedOverflow > 0 && (
                              <div style={{
                                padding: "6px 10px",
                                borderRadius: 6,
                                background: "rgba(248,113,113,0.03)",
                                border: "1px dashed rgba(248,113,113,0.2)",
                                display: "flex",
                                alignItems: "center",
                                fontSize: 11,
                                color: "rgba(248,113,113,0.45)",
                                minWidth: 60,
                              }}>
                                +{delayedOverflow} more
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Empty state */}
                      {!hasAnything && (
                        <div style={{
                          padding: "14px 0",
                          fontSize: 12,
                          color: "var(--text-faint)",
                          fontStyle: "italic",
                        }}>
                          No jobs queued
                        </div>
                      )}
                    </div>
                  )}

                  {!hasAnything && (
                    <div style={{ fontSize: 12, color: "var(--text-faint)", fontStyle: "italic" }}>No jobs queued</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Seed Jobs */}
      <div style={{ marginBottom: 16, maxWidth: 480 }}>
        <div className="card">
          <div className="section-header">
            <span className="section-title">Seed Jobs</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label className="label">
                Job count: <strong style={{ color: "var(--text-primary)" }}>{seedForm.count}</strong>
              </label>
              <input
                type="range"
                min={1}
                max={100}
                value={seedForm.count}
                onChange={(e) => setSeedForm((f) => ({ ...f, count: Number(e.target.value) }))}
                style={{ width: "100%", marginTop: 4 }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)" }}>
                <span>1</span><span>100</span>
              </div>
            </div>
            <div>
              <label className="label">Queue (optional)</label>
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
              <label className="label">Failure mode (optional)</label>
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
            <button className="btn btn-primary" onClick={handleSeed} disabled={seeding}>
              {seeding ? "Seeding..." : `⚡ Seed ${seedForm.count} Jobs`}
            </button>
            {seedMsg && (
              <p
                style={{
                  fontSize: 12,
                  color: seedMsg.startsWith("✓") ? "var(--completed)" : "var(--failed)",
                  marginTop: 2,
                }}
              >
                {seedMsg}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Live Activity Feed */}
      <div className="card">
        <div className="section-header">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="section-title">Live Activity Feed</span>
            <div className="pulse-dot pulse-green" style={{ width: 7, height: 7 }} />
          </div>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>WebSocket · real-time updates</span>
        </div>
        <div
          ref={feedRef}
          style={{
            height: 280,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 3,
          }}
        >
          {feed.length === 0 ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                color: "var(--text-muted)",
                fontSize: 13,
              }}
            >
              Waiting for job events…
            </div>
          ) : (
            feed.map((ev, i) => {
              const cfg = STATUS_CONFIG[ev.status] || STATUS_CONFIG.pending;
              const prevCfg = STATUS_CONFIG[ev.prev_status] || STATUS_CONFIG.pending;
              const ts = new Date(ev.timestamp).toLocaleTimeString("en-US", {
                hour: "2-digit", minute: "2-digit", second: "2-digit"
              });
              return (
                <div
                  key={i}
                  className="feed-item"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "6px 10px",
                    borderRadius: 7,
                    background: i === 0 ? "rgba(255,255,255,0.04)" : "transparent",
                    fontSize: 12,
                  }}
                >
                  <span style={{ color: "var(--text-muted)", fontFamily: "monospace", flexShrink: 0, fontSize: 11 }}>
                    {ts}
                  </span>
                  <span style={{ fontFamily: "monospace", color: "var(--text-muted)", fontSize: 11 }}>
                    #{String(ev.job_id).slice(0, 8)}
                  </span>
                  <span style={{ color: "var(--text-secondary)" }}>{ev.job_type}</span>
                  <span style={{ color: "var(--text-muted)", fontSize: 11 }}>({ev.queue_name})</span>
                  <span style={{ color: "var(--text-muted)" }}>→</span>
                  <span className={`badge ${prevCfg.badgeClass}`} style={{ padding: "1px 7px" }}>
                    {ev.prev_status}
                  </span>
                  <span style={{ color: "var(--text-muted)", fontSize: 14 }}>→</span>
                  <span className={`badge ${cfg.badgeClass}`} style={{ padding: "1px 7px" }}>
                    {ev.status}
                  </span>
                  {ev.status === "processing" && <div className="spinner" />}
                  {ev.error && (
                    <span
                      style={{
                        flex: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        color: "var(--failed)",
                        fontSize: 11,
                      }}
                      title={ev.error}
                    >
                      ✗ {ev.error.slice(0, 60)}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
