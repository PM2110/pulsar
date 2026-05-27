"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { apiService, socket } from "./lib/api.service";
import { Tooltip, Accordion, SearchInput, AnimNum } from "./components/ui";
import { InfiniteScroll } from "./components/InfiniteScroll";
import { useDebounce } from "./hooks/useDebounce";
import { formatTimeIST } from "./lib/utils";

interface Stats {
  jobs: { total: number; pending: number; processing: number; completed: number; failed: number };
  outbox: { total: number; pending: number; processed: number; failed: number };
  queues: {
    depths: Record<string, number>; delayed: Record<string, number>;
    readyJobs: Record<string, { id: string; runAt: number }[]>;
    delayedJobs: Record<string, { id: string; runAt: number; attempts: number }[]>;
    processing: Record<string, { id: string; attempts: number; startedAt: number | null; workerId: string | null; workerHostname: string | null }[]>;
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
  const [attempts, setAttempts] = useState<any[]>([]);
  const attemptsRef = useRef<any[]>([]);
  const [totalAttempts, setTotalAttempts] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [feedSearch, setFeedSearch] = useState("");
  const debouncedSearch = useDebounce(feedSearch, 300);
  const [seeding, setSeeding] = useState(false);
  const [seedForm, setSeedForm] = useState({ count: 10, queue_name: "", failure_mode: "" });
  const [seedMsg, setSeedMsg] = useState<string | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => Date.now());
  const isFetchingRef = useRef(false);

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const fetchStats = useCallback(async () => { try { setStats(await apiService.getStats()); } catch { } }, []);
  useEffect(() => { fetchStats(); socket.on("stats_update", setStats); return () => { socket.off("stats_update"); }; }, [fetchStats]);

  const fetchAttempts = useCallback(async (reset = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setLoadingMore(true);
    try {
      const currentPage = reset ? 1 : Math.floor(attemptsRef.current.length / 15) + 1;
      const res = await apiService.getAttempts({
        limit: 15,
        page: currentPage,
        search: debouncedSearch
      });
      const newAttempts = res.attempts || [];
      const pagination = res.pagination || {};

      setAttempts(prev => {
        const nextVal = reset ? newAttempts : [...prev, ...newAttempts.filter((item: any) => !prev.some(p => p.id === item.id))];
        attemptsRef.current = nextVal;
        return nextVal;
      });
      setHasMore(pagination.hasMore ?? false);
      setTotalAttempts(pagination.totalRecords || 0);
    } catch { }
    finally {
      isFetchingRef.current = false;
      setLoadingMore(false);
    }
  }, [debouncedSearch]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || attempts.length === 0) return;
    await fetchAttempts(false);
  }, [fetchAttempts, loadingMore, hasMore, attempts.length]);

  useEffect(() => {
    fetchAttempts(true);
  }, [debouncedSearch, fetchAttempts]);

  useEffect(() => {
    const handleEvent = (data: any) => {
      if (data.type === "attempt_update" && data.attempt) {
        setAttempts(prev => {
          const exists = prev.some(a => a.id === data.attempt.id);
          let nextVal;
          if (exists) {
            nextVal = prev.map(a => a.id === data.attempt.id ? data.attempt : a);
          } else {
            setTotalAttempts(t => t + 1);
            nextVal = [data.attempt, ...prev];
          }
          attemptsRef.current = nextVal;
          return nextVal;
        });
      }
    };
    socket.on("job_update", handleEvent);
    return () => {
      socket.off("job_update", handleEvent);
    };
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

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredAttempts = attempts;

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
            {(() => {
              const segs = [
                { v: stats?.jobs.pending ?? 0, c: "var(--text-faint)", label: "Pending" },
                { v: stats?.jobs.processing ?? 0, c: "var(--accent)", label: "Processing" },
                { v: stats?.jobs.completed ?? 0, c: "var(--green)", label: "Completed" },
                { v: stats?.jobs.failed ?? 0, c: "var(--red)", label: "Failed" },
              ].filter(s => s.v > 0);
              const visibleSegs = t > 0 ? segs : [];
              return (
                <div style={{ height: 10, borderRadius: 5, overflow: "hidden", background: "var(--bg-inset)", display: "flex", gap: 2, marginBottom: 16 }}>
                  {visibleSegs.map((s, i) => {
                    const isFirst = i === 0;
                    const isLast = i === visibleSegs.length - 1;
                    const borderRadius = `${isFirst ? 4 : 0}px ${isLast ? 4 : 0}px ${isLast ? 4 : 0}px ${isFirst ? 4 : 0}px`;
                    const pct = `${(s.v / t) * 100}%`;
                    return (
                      <Tooltip key={s.label} text={`${s.label}: ${s.v.toLocaleString()} job${s.v !== 1 ? 's' : ''} (${Math.round((s.v / t) * 100)}%)`} style={{ width: pct, transition: "width .5s", height: "100%" }}>
                        <div style={{ width: "100%", height: "100%", background: s.c, borderRadius, cursor: "default" }} />
                      </Tooltip>
                    );
                  })}
                </div>
              );
            })()}
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
                    {(() => {
                      const capSegs = [
                        { v: proc.length, c: "var(--accent)", label: "Processing" },
                        { v: depth, c: "var(--text-faint)", label: "Ready" },
                        { v: delayed, c: "var(--red)", label: "Delayed", opacity: 0.7 },
                      ].filter(s => s.v > 0);
                      return (
                        <div className="capacity-bar">
                          {capSegs.map((s, i) => {
                            const isFirst = i === 0;
                            const isLast = i === capSegs.length - 1;
                            const borderRadius = `${isFirst ? 2 : 0}px ${isLast ? 2 : 0}px ${isLast ? 2 : 0}px ${isFirst ? 2 : 0}px`;
                            const pct = `${(s.v / Math.max(tot, 1)) * 100}%`;
                            return (
                              <Tooltip key={s.label} text={`${s.label}: ${s.v} job${s.v !== 1 ? 's' : ''} (${Math.round((s.v / Math.max(tot, 1)) * 100)}%)`} style={{ width: pct, height: "100%", transition: "width .5s var(--ease)" }}>
                                <div className="capacity-seg" style={{ width: "100%", height: "100%", background: s.c, borderRadius, ...(s.opacity ? { opacity: s.opacity } : {}), cursor: "default" }} />
                              </Tooltip>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
                    {/* Active & Pending Queue Accordion */}
                    <Accordion 
                      title="Active & Ready Queue" 
                      badge={<span className="acc-badge" style={{ background: "var(--accent-soft)", color: "var(--text-primary)" }}>{proc.length + depth}</span>}
                      defaultOpen={proc.length + depth > 0}
                    >
                      {proc.length + ready.length === 0 ? (
                        <div style={{ textAlign: "center", fontSize: 12, color: "var(--text-faint)", fontStyle: "italic", padding: "8px 0" }}>
                          No active or ready jobs
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                          {/* Processing/Active Jobs (Green shaded box) */}
                          {proc.map(j => {
                            const elapsed = j.startedAt ? wt(j.startedAt) : "just now";
                            return (
                              <div key={j.id} style={{
                                background: "var(--green-soft)",
                                border: "1px solid rgba(52, 211, 153, 0.2)",
                                borderRadius: "var(--radius-sm)",
                                padding: "10px 12px",
                                display: "flex",
                                flexDirection: "column",
                                gap: 4,
                                color: "var(--green)"
                              }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: 700, fontSize: "12px" }}>
                                  <span>Job ID: #{j.id}</span>
                                  <span style={{ fontSize: "10px", textTransform: "uppercase", background: "rgba(52, 211, 153, 0.15)", padding: "2px 6px", borderRadius: 4, fontWeight: 800 }}>Processing</span>
                                </div>
                                <div style={{ fontSize: "11px", color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: 2 }}>
                                  <div>Attempt: <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>#{j.attempts}</span></div>
                                  <div>Worker: <code style={{ color: "var(--text-primary)", background: "var(--bg-inset)", padding: "1px 4px", borderRadius: 3, fontSize: "10.5px" }}>{j.workerId || "unknown"}</code> {j.workerHostname ? `(${j.workerHostname})` : ""}</div>
                                  <div>Running for: <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{elapsed}</span></div>
                                </div>
                              </div>
                            );
                          })}
                          
                          {/* Waiting/Pending/Ready Jobs (Grey shaded box) */}
                          {ready.map((r, i) => (
                            <div key={`${r.id}-${i}`} style={{
                              background: "var(--bg-inset)",
                              border: "1px solid var(--border)",
                              borderRadius: "var(--radius-sm)",
                              padding: "10px 12px",
                              display: "flex",
                              flexDirection: "column",
                              gap: 4,
                              color: "var(--text-secondary)"
                            }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: 700, fontSize: "12px" }}>
                                <span>Job ID: #{r.id}</span>
                                <span style={{ fontSize: "10px", textTransform: "uppercase", background: "var(--border)", padding: "2px 6px", borderRadius: 4, color: "var(--text-dim)", fontWeight: 800 }}>Ready</span>
                              </div>
                              <div style={{ fontSize: "11px", color: "var(--text-dim)", display: "flex", flexDirection: "column", gap: 2 }}>
                                <div>Waiting time: <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{wt(r.runAt)}</span></div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </Accordion>

                    {/* Delayed Queue Accordion */}
                    <Accordion 
                      title="Delayed Queue" 
                      badge={<span className="acc-badge" style={{ background: "var(--red-soft)", color: "var(--red)" }}>{delayed}</span>}
                      defaultOpen={delayed > 0}
                    >
                      {delItems.length === 0 ? (
                        <div style={{ textAlign: "center", fontSize: 12, color: "var(--text-faint)", fontStyle: "italic", padding: "8px 0" }}>
                          No delayed jobs
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                          {delItems.map((d, i) => (
                            <div key={`${d.id}-${i}`} style={{
                              background: "var(--red-soft)",
                              border: "1px solid rgba(248, 113, 113, 0.2)",
                              borderRadius: "var(--radius-sm)",
                              padding: "10px 12px",
                              display: "flex",
                              flexDirection: "column",
                              gap: 4,
                              color: "var(--red)"
                            }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: 700, fontSize: "12px" }}>
                                <span>Job ID: #{d.id}</span>
                                <span style={{ fontSize: "10px", textTransform: "uppercase", background: "rgba(248, 113, 113, 0.15)", padding: "2px 6px", borderRadius: 4, fontWeight: 800 }}>Delayed</span>
                              </div>
                              <div style={{ fontSize: "11px", color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: 2 }}>
                                <div>Attempts made: <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{d.attempts}</span></div>
                                <div>Remaining delay: <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{dl(d.runAt)}</span></div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </Accordion>
                  </div>
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
        <div className="section-label">System Logs</div>
        <Accordion
          title="Job Execution History"
          icon={<div className="pulse-dot pulse-green" style={{ width: 9, height: 9 }} />}
          desc="Real-time job attempts, latencies, and execution logs"
          badge={totalAttempts > 0 ? <span className="acc-badge">{totalAttempts} attempts</span> : undefined}
          defaultOpen
        >
          <div style={{ marginBottom: 14 }}>
            <SearchInput placeholder="Search logs by job type, queue, ID, worker, or error..." value={feedSearch} onChange={setFeedSearch} debounceMs={0} />
          </div>
          <div ref={feedRef} style={{
            background: "var(--bg-inset)",
            borderRadius: "var(--radius)",
            border: "1px solid var(--border)",
            padding: "8px",
            fontFamily: "'IBM Plex Mono', 'JetBrains Mono', monospace",
            color: "var(--text-secondary)",
            fontSize: "12.5px",
            maxHeight: "480px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column"
          }}>
            {filteredAttempts.length === 0 ? (
              <div style={{ textAlign: "center", padding: "50px 0", color: "var(--text-faint)", fontSize: 13 }}>
                {feedSearch ? "No matching log entries" : "Waiting for job execution attempts..."}
              </div>
            ) : filteredAttempts.map((att) => {
              const startedTime = formatTimeIST(att.started_at) + " IST";
              const isExpanded = !!expandedIds[att.id];
              return (
                <div key={att.id} className="feed-item" style={{
                  padding: "10px 12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px"
                }}>
                  {/* Log Header Row */}
                  <div
                    onClick={() => toggleExpand(att.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      cursor: "pointer",
                      userSelect: "none",
                      gap: "8px",
                      flexWrap: "wrap",
                      width: "100%"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                      {/* Collapse indicator */}
                      <span style={{ color: "var(--text-dim)", fontSize: "10px", width: "12px", display: "inline-block" }}>
                        {isExpanded ? "▼" : "▶"}
                      </span>
                      {/* Timestamp */}
                      <span style={{ color: "var(--text-dim)", fontFamily: "monospace" }}>
                        [{startedTime}]
                      </span>
                      {/* Queue */}
                      <span style={{ color: "var(--blue)", fontWeight: 600 }}>
                        [{att.queue_name}]
                      </span>
                      {/* Attempt Number */}
                      <span style={{ color: "var(--text-dim)", fontFamily: "monospace" }}>
                        (Attempt #{att.attempt_number})
                      </span>
                      {/* Job Type and ID */}
                      <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
                        {att.job_type}
                      </span>
                      <Tooltip text={`Full Job ID: ${att.job_id}`}>
                        <span style={{ color: "var(--text-dim)", fontFamily: "monospace", fontSize: "11px" }}>
                          #{String(att.job_id).slice(0, 8)}
                        </span>
                      </Tooltip>
                      {/* Timing metrics if finished */}
                      {att.status === "completed" && att.execution_time_ms !== null && (
                        <span style={{ color: "var(--green)", fontSize: "11px" }}>
                          ✓ finished in {att.execution_time_ms}ms
                        </span>
                      )}
                      {att.status === "failed" && (
                        <span style={{ color: "var(--red)", fontSize: "11px", fontWeight: "bold" }}>
                          ✗ failed
                        </span>
                      )}
                      {att.status === "processing" && (
                        <span style={{ color: "var(--accent)", fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                          <span className="spinner" style={{ width: "10px", height: "10px", borderWidth: "1px" }} /> running...
                        </span>
                      )}
                    </div>

                    <div style={{ display: "flex", gap: "12px", alignItems: "center", color: "var(--text-dim)", fontSize: "11px", fontFamily: "monospace" }}>
                      <span>Worker: {att.worker_id}</span>
                    </div>
                  </div>

                  {/* Expandable Details Container */}
                  {isExpanded && (
                    <div style={{
                      marginTop: "10px",
                      padding: "16px",
                      background: "var(--bg-card)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-sm)",
                      color: "var(--text-secondary)",
                      fontSize: "12px",
                      animation: "fadeIn 0.2s ease-out"
                    }}>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px", marginBottom: "16px" }}>
                        <div>
                          <span style={{ color: "var(--text-dim)", fontWeight: "bold", display: "block", marginBottom: "6px", fontSize: "11px", textTransform: "uppercase" }}>Worker Metadata</span>
                          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                            <div>ID: <code style={{ color: "var(--text-primary)", background: "var(--bg-inset)", padding: "2px 4px", borderRadius: "3px" }}>{att.worker_id}</code></div>
                            <div>Hostname: <code style={{ color: "var(--text-primary)", background: "var(--bg-inset)", padding: "2px 4px", borderRadius: "3px" }}>{att.worker_hostname || "N/A"}</code></div>
                            <div>Process PID: <code style={{ color: "var(--text-primary)", background: "var(--bg-inset)", padding: "2px 4px", borderRadius: "3px" }}>{att.worker_pid || "N/A"}</code></div>
                          </div>
                        </div>

                        <div>
                          <span style={{ color: "var(--text-dim)", fontWeight: "bold", display: "block", marginBottom: "6px", fontSize: "11px", textTransform: "uppercase" }}>Timing & Latency</span>
                          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                            <div>Scheduled: <span style={{ color: "var(--text-primary)" }}>{att.scheduled_at ? formatTimeIST(att.scheduled_at) + " IST" : "N/A"}</span></div>
                            <div>Started At: <span style={{ color: "var(--text-primary)" }}>{formatTimeIST(att.started_at)} IST</span></div>
                            <div>Finished At: <span style={{ color: "var(--text-primary)" }}>{att.finished_at ? formatTimeIST(att.finished_at) + " IST" : "Running..."}</span></div>
                            <div>Queue Wait Time: <span style={{ color: att.queue_latency_ms > 10000 ? "var(--red)" : "var(--green)" }}>{att.queue_latency_ms !== null ? `${att.queue_latency_ms}ms` : "N/A"}</span></div>
                          </div>
                        </div>
                      </div>

                      {/* Payload */}
                      <div style={{ marginBottom: "14px" }}>
                        <span style={{ color: "var(--text-dim)", fontWeight: "bold", display: "block", marginBottom: "6px", fontSize: "11px", textTransform: "uppercase" }}>Job Input Payload</span>
                        <pre style={{
                          background: "var(--bg-inset)",
                          padding: "12px",
                          borderRadius: "6px",
                          border: "1px solid var(--border)",
                          overflowX: "auto",
                          fontSize: "11.5px",
                          color: "var(--text-primary)",
                          maxHeight: "200px"
                        }}>
                          {JSON.stringify(att.payload, null, 2)}
                        </pre>
                      </div>

                      {/* Failure / Error display */}
                      {att.status === "failed" && (
                        <div style={{ borderTop: "1px solid var(--red)", paddingTop: "14px", marginTop: "14px" }}>
                          <span style={{ color: "var(--red)", fontWeight: "bold", display: "block", marginBottom: "6px", fontSize: "11px", textTransform: "uppercase" }}>Error Message</span>
                          <div style={{ color: "var(--red)", fontWeight: "bold", marginBottom: "10px" }}>{att.error}</div>
                          {att.stack_trace && (
                            <>
                              <span style={{ color: "var(--text-dim)", fontWeight: "bold", display: "block", marginBottom: "6px", fontSize: "11px", textTransform: "uppercase" }}>Stack Trace</span>
                              <pre style={{
                                background: "var(--bg-inset)",
                                padding: "12px",
                                borderRadius: "6px",
                                border: "1px solid var(--border)",
                                overflowX: "auto",
                                fontSize: "11px",
                                color: "var(--red)",
                                maxHeight: "180px"
                              }}>
                                {att.stack_trace}
                              </pre>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Infinite Scroll Trigger */}
            <InfiniteScroll
              onIntersect={loadMore}
              hasMore={hasMore}
              isLoading={loadingMore}
              rootRef={feedRef}
            />
          </div>
        </Accordion>
      </div>
    </div>
  );
}
