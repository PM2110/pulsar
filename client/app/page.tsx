"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { apiService, socket } from "./lib/api.service";
import { Acc, Tip } from "./components/Accordion";
import { useTheme } from "./components/ThemeProvider";

interface Stats {
  jobs: { total: number; pending: number; processing: number; completed: number; failed: number };
  outbox: { total: number; pending: number; processed: number; failed: number };
  queues: {
    depths: Record<string, number>;
    delayed: Record<string, number>;
    readyJobs: Record<string, { id: string; runAt: number }[]>;
    delayedJobs: Record<string, { id: string; runAt: number }[]>;
    processing: Record<string, { id: string; workerId: string | null; workerHostname: string | null }[]>;
  };
  attempts: { total: number; successful: number; failed: number; avg_execution_ms: number; avg_latency_ms: number };
  throughput_last_60s: number;
  stuck_jobs_count: number;
}

interface FeedEvent {
  type: string; job_id: string; job_type: string; queue_name: string;
  status: string; prev_status: string; attempts: number; max_attempts: number;
  error: string | null; timestamp: string;
}

const STATUS_CFG: Record<string, { badge: string; pulse: string }> = {
  pending: { badge: "badge-pending", pulse: "pulse-gray" },
  processing: { badge: "badge-processing", pulse: "pulse-white" },
  completed: { badge: "badge-completed", pulse: "pulse-green" },
  failed: { badge: "badge-failed", pulse: "pulse-red" },
};
const QUEUES = ["notifications", "media", "default"];
const Q_ICON: Record<string, string> = { notifications: "🔔", media: "🎬", default: "📦" };
const Q_DESC: Record<string, string> = {
  notifications: "Email, SMS & push delivery",
  media: "Image resize, video transcode",
  default: "Exports, reports & maintenance",
};

function Num({ value }: { value: number }) {
  const [d, setD] = useState(value);
  const p = useRef(value);
  useEffect(() => {
    const s = p.current, e = value;
    if (s === e) return;
    const diff = e - s; let step = 0;
    const t = setInterval(() => { step++; setD(Math.round(s + diff * (step / 18))); if (step >= 18) { clearInterval(t); p.current = e; } }, 22);
    return () => clearInterval(t);
  }, [value]);
  return <>{d.toLocaleString()}</>;
}

export default function DashboardPage() {
  const { theme, toggleTheme } = useTheme();
  const [stats, setStats] = useState<Stats | null>(null);
  const [feed, setFeed] = useState<FeedEvent[]>([]);
  const [seeding, setSeeding] = useState(false);
  const [seedForm, setSeedForm] = useState({ count: 10, queue_name: "", failure_mode: "" });
  const [seedMsg, setSeedMsg] = useState<string | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const fetchStats = useCallback(async () => { try { setStats(await apiService.getStats()); } catch {} }, []);
  useEffect(() => { fetchStats(); socket.on("stats_update", setStats); return () => { socket.off("stats_update"); }; }, [fetchStats]);
  useEffect(() => {
    const h = (ev: FeedEvent) => {
      const e = { ...ev, timestamp: ev.timestamp || new Date().toISOString() };
      setFeed(p => [e, ...p].slice(0, 50));
      setTimeout(() => feedRef.current?.scrollTo({ top: 0, behavior: "smooth" }), 50);
    };
    socket.on("job_update", h); return () => { socket.off("job_update", h); };
  }, []);

  const handleSeed = async () => {
    setSeeding(true); setSeedMsg(null);
    try {
      const body: Record<string, unknown> = { count: seedForm.count };
      if (seedForm.queue_name) body.queue_name = seedForm.queue_name;
      if (seedForm.failure_mode) body.failure_mode = seedForm.failure_mode;
      const r = await apiService.seedJobs(body);
      setSeedMsg(`✓ Seeded ${r.count} jobs`); fetchStats();
    } catch { setSeedMsg("✗ Failed to seed jobs"); }
    finally { setSeeding(false); }
  };

  const t = stats?.jobs.total || 0;
  const items = [
    { k: "Pending", v: stats?.jobs.pending ?? 0, c: "var(--pending)", d: "pulse-gray", tip: "Waiting to be picked up by a worker" },
    { k: "Processing", v: stats?.jobs.processing ?? 0, c: "var(--processing)", d: "pulse-white", tip: "Currently being executed by workers" },
    { k: "Completed", v: stats?.jobs.completed ?? 0, c: "var(--completed)", d: "pulse-green", tip: "Successfully finished" },
    { k: "Failed", v: stats?.jobs.failed ?? 0, c: "var(--failed)", d: "pulse-red", tip: "Exhausted all retry attempts" },
  ];
  const wt = (runAt: number) => { const s = Math.max(0, Math.round((now - runAt) / 1000)); return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`; };
  const dl = (runAt: number) => { const s = Math.max(0, Math.round((runAt - now) / 1000)); return s >= 60 ? `in ${Math.floor(s / 60)}m ${s % 60}s` : `in ${s}s`; };

  return (
    <div className="page">
      {/* ─── ROW 1: Header ─── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-sub">Real-time system overview · WebSocket connected</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span className="chip"><div className="pulse-dot pulse-green" style={{ width: 6, height: 6 }} /> Live</span>
          <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">{theme === "dark" ? "☀️" : "🌙"}</button>
        </div>
      </div>

      {/* ─── ALERT ROW ─── */}
      {stats && stats.stuck_jobs_count > 0 && (
        <div style={{ background: "var(--red-soft)", border: "1px solid var(--red)", borderRadius: "var(--radius-lg)", padding: "14px 20px", marginBottom: 20, display: "flex", alignItems: "center", gap: 14, animation: "soft-blink 2s ease-in-out infinite" }}>
          <span style={{ fontSize: 22 }}>⚠️</span>
          <div>
            <div style={{ fontWeight: 700, color: "var(--red)", fontSize: 13 }}>Stuck Jobs Detected</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{stats.stuck_jobs_count} job(s) pending 60s+ — possible worker capacity issue</div>
          </div>
        </div>
      )}

      {/* ─── ROW 2: Job Status Cards ─── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
        {items.map(s => (
          <Tip key={s.k} text={s.tip}>
            <div className="stat-card" style={{ width: "100%" }}>
              <div className="stat-card-label"><div className={`pulse-dot ${s.d}`} /> {s.k}</div>
              <div className="stat-value" style={{ color: s.c }}><Num value={s.v} /></div>
              <div className="stat-sub">{t > 0 ? Math.round((s.v / t) * 100) : 0}% of {t.toLocaleString()} total</div>
            </div>
          </Tip>
        ))}
      </div>

      {/* ─── ROW 3: Distribution Bar (standalone) ─── */}
      <div className="card" style={{ marginBottom: 24, padding: "16px 22px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>Job Distribution</span>
          <span className="chip">{t} total</span>
        </div>
        <div style={{ height: 8, borderRadius: 4, overflow: "hidden", background: "var(--bg-inset)", display: "flex", gap: 2, marginBottom: 12 }}>
          {items.map(s => <div key={s.k} style={{ width: `${t > 0 ? (s.v / t) * 100 : 0}%`, background: s.c, borderRadius: 3, transition: "width 0.5s" }} />)}
        </div>
        <div style={{ display: "flex", gap: 24 }}>
          {items.map(s => (
            <div key={s.k} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: s.c }} />
              <span style={{ color: "var(--text-muted)" }}>{s.k}</span>
              <span style={{ color: "var(--text-secondary)", fontWeight: 700 }}>{s.v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ─── ROW 4: Performance Metrics (accordion) ─── */}
      <div style={{ marginBottom: 16 }}>
        <Acc title="Performance Metrics" icon="📊" desc="Throughput, execution time, and queue latency" badge={<span className="acc-badge">{stats?.throughput_last_60s ?? 0} jobs/min</span>} open={true}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {[
              { l: "Throughput / 60s", v: stats?.throughput_last_60s ?? 0, u: "jobs", c: "var(--green)", tip: "Jobs completed in the last 60 seconds" },
              { l: "Avg Execution", v: stats?.attempts.avg_execution_ms ?? 0, u: "ms", c: "var(--text-primary)", tip: "Average worker execution time" },
              { l: "Avg Queue Latency", v: stats?.attempts.avg_latency_ms ?? 0, u: "ms", c: "var(--text-primary)", tip: "Average wait time before processing" },
              { l: "Total Attempts", v: stats?.attempts.total ?? 0, u: "", c: "var(--text-primary)", tip: "Sum of all execution attempts" },
            ].map(m => (
              <Tip key={m.l} text={m.tip}>
                <div className="inset-row" style={{ width: "100%", textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: "var(--text-faint)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>{m.l}</div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: m.c, fontVariantNumeric: "tabular-nums" }}>
                    <Num value={Math.round(m.v)} />
                    {m.u && <span style={{ fontSize: 11, fontWeight: 500, marginLeft: 3, color: "var(--text-faint)" }}>{m.u}</span>}
                  </div>
                </div>
              </Tip>
            ))}
          </div>
        </Acc>
      </div>

      {/* ─── ROW 5: Outbox Pipeline (accordion) ─── */}
      <div style={{ marginBottom: 16 }}>
        <Acc title="Outbox Relay Pipeline" icon="📡" desc="Transactional outbox between DB and Redis" badge={<span className="acc-badge">{stats?.outbox.total || 0}</span>}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {[
              { l: "Pending", v: stats?.outbox.pending ?? 0, c: "var(--text-secondary)" },
              { l: "Relayed", v: stats?.outbox.processed ?? 0, c: "var(--green)" },
              { l: "Failed", v: stats?.outbox.failed ?? 0, c: "var(--red)" },
            ].map(m => (
              <div key={m.l} className="inset-row" style={{ textAlign: "center" }}>
                <div style={{ fontSize: 10, color: "var(--text-faint)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>{m.l}</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: m.c }}><Num value={m.v} /></div>
              </div>
            ))}
          </div>
        </Acc>
      </div>

      {/* ─── ROW 6: Queue Lanes (each queue = big card) ─── */}
      <div style={{ marginBottom: 16 }}>
        <Acc title="Queue Lanes" icon="🚦" desc="Live queue depths, processing, and delayed jobs" badge={<span className="acc-badge">{QUEUES.length} queues</span>} open={true}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
            {QUEUES.map(q => {
              const depth = stats?.queues.depths[q] ?? 0;
              const delayed = stats?.queues.delayed[q] ?? 0;
              const proc = stats?.queues.processing[q] ?? [];
              const ready = stats?.queues.readyJobs[q] ?? [];
              const delItems = stats?.queues.delayedJobs[q] ?? [];
              const tot = depth + delayed + proc.length;
              const hasAny = tot > 0;

              return (
                <div key={q} className="queue-card">
                  {/* Header */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                    <div className="queue-icon">{Q_ICON[q]}</div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{q}</div>
                      <div style={{ fontSize: 11, color: "var(--text-faint)" }}>{Q_DESC[q]}</div>
                    </div>
                  </div>

                  {/* 3 mini stats */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
                    <Tip text="Actively being processed"><div className="queue-mini-stat" style={{ width: "100%" }}><div className="queue-mini-stat-label">Active</div><div className="queue-mini-stat-value" style={{ color: proc.length > 0 ? "var(--accent)" : "var(--text-faint)" }}>{proc.length}</div></div></Tip>
                    <Tip text="Ready and waiting"><div className="queue-mini-stat" style={{ width: "100%" }}><div className="queue-mini-stat-label">Ready</div><div className="queue-mini-stat-value" style={{ color: depth > 0 ? "var(--text-primary)" : "var(--text-faint)" }}>{depth}</div></div></Tip>
                    <Tip text="Scheduled for later"><div className="queue-mini-stat" style={{ width: "100%" }}><div className="queue-mini-stat-label">Delayed</div><div className="queue-mini-stat-value" style={{ color: delayed > 0 ? "var(--red)" : "var(--text-faint)" }}>{delayed}</div></div></Tip>
                  </div>

                  {/* Bar */}
                  <div style={{ marginBottom: hasAny ? 12 : 0 }}>
                    <div className="queue-bar">
                      {proc.length > 0 && <div className="queue-bar-seg" style={{ width: `${(proc.length / Math.max(tot, 1)) * 100}%`, background: "var(--accent)" }} />}
                      {depth > 0 && <div className="queue-bar-seg" style={{ width: `${(depth / Math.max(tot, 1)) * 100}%`, background: "var(--text-muted)" }} />}
                      {delayed > 0 && <div className="queue-bar-seg" style={{ width: `${(delayed / Math.max(tot, 1)) * 100}%`, background: "var(--red)", opacity: 0.7 }} />}
                    </div>
                  </div>

                  {/* Job chips (nested accordion) */}
                  {hasAny ? (
                    <Acc title="Jobs in queue" badge={<span className="acc-badge">{tot}</span>}>
                      {proc.length > 0 && (
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ fontSize: 9, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Processing</div>
                          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                            {proc.map(j => (
                              <Tip key={j.id} text={`Worker: ${j.workerId ?? "—"}`}>
                                <div style={{ padding: "5px 9px", borderRadius: "var(--radius-xs)", background: "var(--processing-bg)", border: "1px solid var(--accent)", fontSize: 11, fontFamily: "monospace", fontWeight: 600, color: "var(--accent)" }}>#{j.id}</div>
                              </Tip>
                            ))}
                          </div>
                        </div>
                      )}
                      {ready.length > 0 && (
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ fontSize: 9, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Ready</div>
                          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                            {ready.map((r, i) => (
                              <div key={`${r.id}-${i}`} style={{ padding: "5px 9px", borderRadius: "var(--radius-xs)", background: "var(--bg-inset)", border: "1px solid var(--border)", fontSize: 11, fontFamily: "monospace", color: "var(--text-muted)" }}>
                                <span style={{ fontWeight: 600 }}>#{r.id}</span> <span style={{ fontSize: 9, color: "var(--text-faint)" }}>wait {wt(r.runAt)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {delItems.length > 0 && (
                        <div>
                          <div style={{ fontSize: 9, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Delayed</div>
                          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                            {delItems.map((d, i) => (
                              <div key={`${d.id}-${i}`} style={{ padding: "5px 9px", borderRadius: "var(--radius-xs)", background: "var(--red-soft)", border: "1px solid var(--red)", fontSize: 11, fontFamily: "monospace", color: "var(--red)", opacity: 0.85 }}>
                                #{d.id} <span style={{ fontSize: 9 }}>{dl(d.runAt)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </Acc>
                  ) : (
                    <div style={{ textAlign: "center", fontSize: 11, color: "var(--text-faint)", fontStyle: "italic", padding: "6px 0" }}>Idle — no jobs</div>
                  )}
                </div>
              );
            })}
          </div>
        </Acc>
      </div>

      {/* ─── ROW 7: Seed Jobs (accordion) ─── */}
      <div style={{ marginBottom: 16 }}>
        <Acc title="Seed Jobs" icon="⚡" desc="Inject test jobs into the pipeline">
          <div style={{ maxWidth: 400, display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label className="label">Count: <strong style={{ color: "var(--text-primary)" }}>{seedForm.count}</strong></label>
              <input type="range" min={1} max={100} value={seedForm.count} onChange={e => setSeedForm(f => ({ ...f, count: +e.target.value }))} style={{ width: "100%" }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-faint)" }}><span>1</span><span>100</span></div>
            </div>
            <div><label className="label">Queue</label><select className="select" value={seedForm.queue_name} onChange={e => setSeedForm(f => ({ ...f, queue_name: e.target.value }))}><option value="">Random</option>{QUEUES.map(q => <option key={q} value={q}>{q}</option>)}</select></div>
            <div><label className="label">Failure Mode</label><select className="select" value={seedForm.failure_mode} onChange={e => setSeedForm(f => ({ ...f, failure_mode: e.target.value }))}><option value="">Random</option><option value="succeed">Always succeed</option><option value="fail">Always fail</option><option value="probably_fail">Probabilistic</option></select></div>
            <button className="btn btn-primary" onClick={handleSeed} disabled={seeding}>{seeding ? "Seeding..." : `⚡ Seed ${seedForm.count} Jobs`}</button>
            {seedMsg && <p style={{ fontSize: 12, color: seedMsg.startsWith("✓") ? "var(--green)" : "var(--red)" }}>{seedMsg}</p>}
          </div>
        </Acc>
      </div>

      {/* ─── ROW 8: Live Feed (accordion, default open) ─── */}
      <Acc title="Live Activity Feed" icon={<div className="pulse-dot pulse-green" style={{ width: 8, height: 8 }} />} desc="Real-time job state transitions via WebSocket" badge={feed.length > 0 ? <span className="acc-badge">{feed.length}</span> : undefined} open={true}>
        <div ref={feedRef} style={{ maxHeight: 280, overflowY: "auto" }}>
          {feed.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-faint)", fontSize: 12 }}>Waiting for job events…</div>
          ) : feed.map((ev, i) => {
            const c = STATUS_CFG[ev.status] || STATUS_CFG.pending;
            const pc = STATUS_CFG[ev.prev_status] || STATUS_CFG.pending;
            const ts = new Date(ev.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
            return (
              <div key={i} className="feed-item" style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: "var(--radius-xs)", background: i === 0 ? "var(--bg-inset)" : "transparent", fontSize: 12 }}>
                <span style={{ color: "var(--text-faint)", fontFamily: "monospace", fontSize: 10, flexShrink: 0 }}>{ts}</span>
                <span style={{ fontFamily: "monospace", color: "var(--text-muted)", fontSize: 10 }}>#{String(ev.job_id).slice(0, 8)}</span>
                <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>{ev.job_type}</span>
                <span style={{ color: "var(--text-faint)", fontSize: 10 }}>({ev.queue_name})</span>
                <span className={`badge ${pc.badge}`} style={{ padding: "1px 6px" }}>{ev.prev_status}</span>
                <span style={{ color: "var(--text-faint)" }}>→</span>
                <span className={`badge ${c.badge}`} style={{ padding: "1px 6px" }}>{ev.status}</span>
                {ev.status === "processing" && <div className="spinner" />}
                {ev.error && <span title={ev.error} style={{ color: "var(--red)", fontSize: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160 }}>✗ {ev.error.slice(0, 40)}</span>}
              </div>
            );
          })}
        </div>
      </Acc>
    </div>
  );
}
