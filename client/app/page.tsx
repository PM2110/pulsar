"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { apiService, socket } from "./lib/api.service";
import { Tooltip, Accordion, SearchInput, AnimNum } from "./components/ui";

interface Stats {
  jobs: { total: number; pending: number; processing: number; completed: number; failed: number };
  outbox: { total: number; pending: number; processed: number; failed: number };
  queues: {
    depths: Record<string, number>; delayed: Record<string, number>;
    readyJobs: Record<string, { id: string; runAt: number }[]>;
    delayedJobs: Record<string, { id: string; runAt: number }[]>;
    processing: Record<string, { id: string; workerId: string | null; workerHostname: string | null }[]>;
  };
  attempts: { total: number; successful: number; failed: number; avg_execution_ms: number; avg_latency_ms: number };
  throughput_last_60s: number; stuck_jobs_count: number;
}
interface FeedEvent {
  type: string; job_id: string; job_type: string; queue_name: string;
  status: string; prev_status: string; attempts: number; max_attempts: number;
  error: string | null; timestamp: string;
}

const BADGE: Record<string, string> = { pending: "badge-pending", processing: "badge-processing", completed: "badge-completed", failed: "badge-failed" };
const QUEUES = ["notifications", "media", "default"];
const Q_ICON: Record<string, string> = { notifications: "🔔", media: "🎬", default: "📦" };
const Q_DESC: Record<string, string> = { notifications: "Email, SMS & push notification delivery pipeline", media: "Image processing, video transcoding & thumbnail generation", default: "Data exports, scheduled reports & system maintenance" };

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [feed, setFeed] = useState<FeedEvent[]>([]);
  const [feedSearch, setFeedSearch] = useState("");
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
    } catch { setSeedMsg("✗ Failed"); } finally { setSeeding(false); }
  };

  const t = stats?.jobs.total || 0;
  const wt = (runAt: number) => { const s = Math.max(0, Math.round((now - runAt) / 1000)); return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`; };
  const dl = (runAt: number) => { const s = Math.max(0, Math.round((runAt - now) / 1000)); return s >= 60 ? `in ${Math.floor(s / 60)}m ${s % 60}s` : `in ${s}s`; };

  const filteredFeed = feedSearch
    ? feed.filter(e => e.job_type.toLowerCase().includes(feedSearch.toLowerCase()) || e.queue_name.toLowerCase().includes(feedSearch.toLowerCase()) || e.job_id.includes(feedSearch))
    : feed;

  return (
    <div className="page-wrap">
      {/* ══════ HEADER ══════ */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-sub">Real-time system overview · All metrics update via WebSocket</p>
        </div>
        <div className="page-actions">
          <span className="chip"><div className="pulse-dot pulse-green" style={{ width: 7, height: 7 }} /> Live</span>
        </div>
      </div>

      {/* ══════ ALERT ══════ */}
      {stats && stats.stuck_jobs_count > 0 && (
        <div className="section">
          <div style={{ background: "var(--red-soft)", border: "1px solid var(--red)", borderRadius: "var(--radius)", padding: "18px 24px", display: "flex", alignItems: "center", gap: 16, animation: "blink 2s ease infinite" }}>
            <span style={{ fontSize: 26 }}>⚠️</span>
            <div>
              <div style={{ fontWeight: 800, color: "var(--red)", fontSize: 14 }}>Stuck Jobs Detected</div>
              <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>{stats.stuck_jobs_count} job(s) pending for 60s+ — possible worker capacity issue</div>
            </div>
          </div>
        </div>
      )}

      {/* ══════ ROW 1: HERO STATS ══════ */}
      <div className="section">
        <div className="section-label">Job Status Overview</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          {[
            { k: "Pending", v: stats?.jobs.pending ?? 0, c: "var(--text-dim)", bar: "var(--text-faint)", tip: "Jobs queued and waiting for a worker" },
            { k: "Processing", v: stats?.jobs.processing ?? 0, c: "var(--accent)", bar: "var(--accent)", tip: "Jobs currently being executed by workers" },
            { k: "Completed", v: stats?.jobs.completed ?? 0, c: "var(--green)", bar: "var(--green)", tip: "Successfully completed jobs" },
            { k: "Failed", v: stats?.jobs.failed ?? 0, c: "var(--red)", bar: "var(--red)", tip: "Jobs that exhausted all retry attempts" },
          ].map(s => (
            <Tooltip key={s.k} text={s.tip}>
              <div className="hero-stat" style={{ width: "100%" }}>
                <div className="hero-stat-label">
                  <div className="pulse-dot" style={{ background: s.bar, width: 8, height: 8 }} />
                  {s.k}
                </div>
                <div className="hero-stat-value" style={{ color: s.c }}><AnimNum value={s.v} /></div>
                <div className="hero-stat-sub">{t > 0 ? Math.round((s.v / t) * 100) : 0}% of {t.toLocaleString()} total jobs</div>
                <div className="hero-stat-bar" style={{ background: s.bar, opacity: 0.15 }} />
              </div>
            </Tooltip>
          ))}
        </div>
      </div>

      {/* ══════ ROW 2: DISTRIBUTION ══════ */}
      <div className="section">
        <div className="section-label">Job Distribution</div>
        <div className="card">
          <div className="card-body" style={{ padding: "20px 24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>Status Breakdown</span>
              <span className="chip">{t.toLocaleString()} total</span>
            </div>
            <div style={{ height: 10, borderRadius: 5, overflow: "hidden", background: "var(--bg-inset)", display: "flex", gap: 2, marginBottom: 16 }}>
              {[
                { v: stats?.jobs.pending ?? 0, c: "var(--text-faint)" },
                { v: stats?.jobs.processing ?? 0, c: "var(--accent)" },
                { v: stats?.jobs.completed ?? 0, c: "var(--green)" },
                { v: stats?.jobs.failed ?? 0, c: "var(--red)" },
              ].map((s, i) => <div key={i} style={{ width: `${t > 0 ? (s.v / t) * 100 : 0}%`, background: s.c, borderRadius: 4, transition: "width .5s" }} />)}
            </div>
            <div style={{ display: "flex", gap: 28 }}>
              {[
                { k: "Pending", v: stats?.jobs.pending ?? 0, c: "var(--text-faint)" },
                { k: "Processing", v: stats?.jobs.processing ?? 0, c: "var(--accent)" },
                { k: "Completed", v: stats?.jobs.completed ?? 0, c: "var(--green)" },
                { k: "Failed", v: stats?.jobs.failed ?? 0, c: "var(--red)" },
              ].map(s => (
                <div key={s.k} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: s.c }} />
                  <span style={{ color: "var(--text-dim)" }}>{s.k}</span>
                  <span style={{ fontWeight: 700 }}>{s.v.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ══════ ROW 3: PERFORMANCE (accordion) ══════ */}
      <div className="section">
        <div className="section-label">Performance & Throughput</div>
        <Accordion title="Performance Metrics" icon="📈" desc="Throughput, execution time, and queue latency" badge={<span className="acc-badge">{stats?.throughput_last_60s ?? 0} jobs/min</span>} defaultOpen>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
            {[
              { l: "Throughput / 60s", v: stats?.throughput_last_60s ?? 0, u: "jobs", c: "var(--green)", tip: "Jobs processed in the last 60 seconds" },
              { l: "Avg Execution", v: stats?.attempts.avg_execution_ms ?? 0, u: "ms", c: "var(--text-primary)", tip: "Average time a worker takes to process a job" },
              { l: "Avg Queue Latency", v: stats?.attempts.avg_latency_ms ?? 0, u: "ms", c: "var(--text-primary)", tip: "Average time a job waits before being picked up" },
              { l: "Total Attempts", v: stats?.attempts.total ?? 0, u: "", c: "var(--text-primary)", tip: "Total number of execution attempts across all jobs" },
            ].map(m => (
              <Tooltip key={m.l} text={m.tip}>
                <div className="inset" style={{ width: "100%", textAlign: "center" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 10 }}>{m.l}</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: m.c, fontVariantNumeric: "tabular-nums", letterSpacing: "-.03em" }}>
                    <AnimNum value={Math.round(m.v)} />
                    {m.u && <span style={{ fontSize: 12, fontWeight: 500, marginLeft: 3, color: "var(--text-faint)" }}>{m.u}</span>}
                  </div>
                </div>
              </Tooltip>
            ))}
          </div>
        </Accordion>
      </div>

      {/* ══════ ROW 4: OUTBOX (accordion, collapsed) ══════ */}
      <div className="section">
        <div className="section-label">Transactional Outbox</div>
        <Accordion title="Outbox Relay Pipeline" icon="📡" desc="Atomic relay between PostgreSQL and Redis" badge={<span className="acc-badge">{stats?.outbox.total || 0} events</span>}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
            {[
              { l: "Pipeline Pending", v: stats?.outbox.pending ?? 0, c: "var(--text-secondary)" },
              { l: "Relayed Successfully", v: stats?.outbox.processed ?? 0, c: "var(--green)" },
              { l: "Relay Failed", v: stats?.outbox.failed ?? 0, c: "var(--red)" },
            ].map(m => (
              <div key={m.l} className="inset" style={{ textAlign: "center" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>{m.l}</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: m.c }}><AnimNum value={m.v} /></div>
              </div>
            ))}
          </div>
        </Accordion>
      </div>

      {/* ══════ ROW 5: QUEUE LANES (accordion, open) ══════ */}
      <div className="section">
        <div className="section-label">Queue Health</div>
        <Accordion title="Queue Lanes" icon="🚦" desc="Live depths, processing counts, and delayed jobs" badge={<span className="acc-badge">{QUEUES.length} queues</span>} defaultOpen>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
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
                  <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
                    <div className="queue-card-icon">{Q_ICON[q]}</div>
                    <div>
                      <div className="queue-card-name">{q}</div>
                      <div className="queue-card-desc">{Q_DESC[q]}</div>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
                    <Tooltip text="Jobs actively being processed by workers">
                      <div className="queue-mini" style={{ width: "100%" }}>
                        <div className="queue-mini-label">Active</div>
                        <div className="queue-mini-val" style={{ color: proc.length > 0 ? "var(--accent)" : "var(--text-faint)" }}>{proc.length}</div>
                      </div>
                    </Tooltip>
                    <Tooltip text="Jobs ready and waiting to be picked up">
                      <div className="queue-mini" style={{ width: "100%" }}>
                        <div className="queue-mini-label">Ready</div>
                        <div className="queue-mini-val" style={{ color: depth > 0 ? "var(--text-primary)" : "var(--text-faint)" }}>{depth}</div>
                      </div>
                    </Tooltip>
                    <Tooltip text="Jobs scheduled for future execution">
                      <div className="queue-mini" style={{ width: "100%" }}>
                        <div className="queue-mini-label">Delayed</div>
                        <div className="queue-mini-val" style={{ color: delayed > 0 ? "var(--red)" : "var(--text-faint)" }}>{delayed}</div>
                      </div>
                    </Tooltip>
                  </div>
                  <div style={{ marginBottom: hasAny ? 14 : 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-faint)", marginBottom: 5, fontWeight: 600 }}>
                      <span>CAPACITY</span><span>{tot} JOBS</span>
                    </div>
                    <div className="capacity-bar">
                      {proc.length > 0 && <div className="capacity-seg" style={{ width: `${(proc.length / Math.max(tot, 1)) * 100}%`, background: "var(--accent)" }} />}
                      {depth > 0 && <div className="capacity-seg" style={{ width: `${(depth / Math.max(tot, 1)) * 100}%`, background: "var(--text-faint)" }} />}
                      {delayed > 0 && <div className="capacity-seg" style={{ width: `${(delayed / Math.max(tot, 1)) * 100}%`, background: "var(--red)", opacity: .7 }} />}
                    </div>
                  </div>
                  {hasAny ? (
                    <Accordion title={`${tot} jobs in queue`} badge={<span className="acc-badge">{tot}</span>}>
                      {proc.map(j => <div key={j.id} style={{ display: "inline-flex", padding: "5px 10px", borderRadius: 4, background: "var(--accent-soft)", border: "1px solid var(--accent)", fontSize: 11, fontFamily: "monospace", fontWeight: 600, color: "var(--accent)", marginRight: 6, marginBottom: 4 }}>#{j.id}</div>)}
                      {ready.map((r, i) => <div key={`${r.id}-${i}`} style={{ display: "inline-flex", padding: "5px 10px", borderRadius: 4, background: "var(--bg-inset)", border: "1px solid var(--border)", fontSize: 11, fontFamily: "monospace", color: "var(--text-dim)", marginRight: 6, marginBottom: 4 }}>#{r.id} <span style={{ fontSize: 9, color: "var(--text-faint)", marginLeft: 4 }}>wait {wt(r.runAt)}</span></div>)}
                      {delItems.map((d, i) => <div key={`${d.id}-${i}`} style={{ display: "inline-flex", padding: "5px 10px", borderRadius: 4, background: "var(--red-soft)", border: "1px solid var(--red)", fontSize: 11, fontFamily: "monospace", color: "var(--red)", opacity: .85, marginRight: 6, marginBottom: 4 }}>#{d.id} <span style={{ fontSize: 9, marginLeft: 4 }}>{dl(d.runAt)}</span></div>)}
                    </Accordion>
                  ) : (
                    <div style={{ textAlign: "center", fontSize: 12, color: "var(--text-faint)", fontStyle: "italic", padding: "8px 0" }}>Queue idle — no pending jobs</div>
                  )}
                </div>
              );
            })}
          </div>
        </Accordion>
      </div>

      {/* ══════ ROW 6: SEED JOBS (accordion, collapsed) ══════ */}
      <div className="section">
        <div className="section-label">Tools</div>
        <Accordion title="Seed Test Jobs" icon="⚡" desc="Inject test jobs into the processing pipeline">
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {/* Row 1: Slider (full width) */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                <label className="label" style={{ marginBottom: 0 }}>Job Count</label>
                <span style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{seedForm.count}</span>
              </div>
              <input type="range" min={1} max={100} value={seedForm.count} onChange={e => setSeedForm(f => ({ ...f, count: +e.target.value }))} style={{ width: "100%" }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-faint)", marginTop: 4 }}><span>1</span><span>50</span><span>100</span></div>
            </div>

            {/* Row 2: Queue + Failure Mode (side by side) */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label className="label">Target Queue</label>
                <select className="select" value={seedForm.queue_name} onChange={e => setSeedForm(f => ({ ...f, queue_name: e.target.value }))}>
                  <option value="">Random</option>
                  {QUEUES.map(q => <option key={q} value={q}>{q}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Failure Mode</label>
                <select className="select" value={seedForm.failure_mode} onChange={e => setSeedForm(f => ({ ...f, failure_mode: e.target.value }))}>
                  <option value="">Random</option>
                  <option value="succeed">Always Succeed</option>
                  <option value="fail">Always Fail</option>
                  <option value="probably_fail">Probabilistic</option>
                </select>
              </div>
            </div>

            {/* Row 3: Button (full width) */}
            <button className="btn btn-primary" onClick={handleSeed} disabled={seeding} style={{ height: 44, width: "100%", fontSize: 14 }}>
              {seeding ? "Seeding..." : `⚡ Seed ${seedForm.count} Jobs`}
            </button>
            {seedMsg && <p style={{ fontSize: 12, color: seedMsg.startsWith("✓") ? "var(--green)" : "var(--red)", textAlign: "center" }}>{seedMsg}</p>}
          </div>
        </Accordion>
      </div>

      {/* ══════ ROW 7: LIVE FEED (accordion, open, with search) ══════ */}
      <div className="section">
        <div className="section-label">Activity</div>
        <Accordion title="Live Activity Feed" icon={<div className="pulse-dot pulse-green" style={{ width: 9, height: 9 }} />} desc="Real-time job state transitions via WebSocket" badge={feed.length > 0 ? <span className="acc-badge">{feed.length}</span> : undefined} defaultOpen>
          <div style={{ marginBottom: 14 }}>
            <SearchInput placeholder="Search by job type, queue, or ID..." value={feedSearch} onChange={setFeedSearch} debounceMs={200} />
          </div>
          <div ref={feedRef} style={{ maxHeight: 320, overflowY: "auto" }}>
            {filteredFeed.length === 0 ? (
              <div style={{ textAlign: "center", padding: "50px 0", color: "var(--text-faint)", fontSize: 13 }}>{feedSearch ? "No matching events" : "Waiting for job events…"}</div>
            ) : filteredFeed.map((ev, i) => {
              const ts = new Date(ev.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
              return (
                <div key={i} className="feed-item" style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 4, fontSize: 12 }}>
                  <span style={{ color: "var(--text-faint)", fontFamily: "monospace", fontSize: 10, flexShrink: 0 }}>{ts}</span>
                  <Tooltip text={`Full ID: ${ev.job_id}`}><span style={{ fontFamily: "monospace", color: "var(--text-dim)", fontSize: 10 }}>#{String(ev.job_id).slice(0, 8)}</span></Tooltip>
                  <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>{ev.job_type}</span>
                  <span className="chip" style={{ padding: "2px 6px", fontSize: 9 }}>{ev.queue_name}</span>
                  <span className={`badge ${BADGE[ev.prev_status] || "badge-pending"}`} style={{ padding: "2px 6px" }}>{ev.prev_status}</span>
                  <span style={{ color: "var(--text-faint)" }}>→</span>
                  <span className={`badge ${BADGE[ev.status] || "badge-pending"}`} style={{ padding: "2px 6px" }}>{ev.status}</span>
                  {ev.status === "processing" && <div className="spinner" />}
                  {ev.error && <Tooltip text={ev.error}><span style={{ color: "var(--red)", fontSize: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 140, display: "inline-block" }}>✗ {ev.error.slice(0, 35)}</span></Tooltip>}
                </div>
              );
            })}
          </div>
        </Accordion>
      </div>
    </div>
  );
}
