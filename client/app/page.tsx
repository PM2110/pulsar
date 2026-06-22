"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { apiService, socket } from "./lib/api.service";
import { useDebounce } from "./hooks/useDebounce";
import { DistributionBar } from "./components/dashboard/DistributionBar";
import { PerformanceMetrics } from "./components/dashboard/PerformanceMetrics";
import { OutboxPanel } from "./components/dashboard/OutboxPanel";
import { QueueLanes } from "./components/dashboard/QueueLanes";
import { SeedJobs } from "./components/dashboard/SeedJobs";
import { ExecutionHistory } from "./components/dashboard/ExecutionHistory";
import { Tooltip } from "./components/ui/Tooltip";

interface Stats {
  jobs: { total: number; pending: number; processing: number; completed: number; failed: number; delayed?: number };
  outbox: { total: number; pending: number; processed: number; failed: number };
  queues: {
    depths: Record<string, number>;
    delayed: Record<string, number>;
    readyJobs: Record<string, { id: string; runAt: number }[]>;
    delayedJobs: Record<string, { id: string; runAt: number; attempts: number }[]>;
    processing: Record<string, { id: string; attempts: number; startedAt: number | null; workerId: string | null; workerHostname: string | null }[]>;
  };
  attempts: { total: number; successful: number; failed: number; avg_execution_ms: number; avg_latency_ms: number };
  throughput_last_60s: number;
  stuck_jobs_count: number;
}

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
  const feedRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => Date.now());
  const isFetchingRef = useRef(false);

  // Job selection and content tabs state
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedJobDetails, setSelectedJobDetails] = useState<{ job: any; attempts: any[] } | null>(null);
  const [selectedTab, setSelectedTab] = useState<"details" | "payload" | "error">("details");
  const [contentTab, setContentTab] = useState<"detail" | "log">("detail");

  // Refresh clock
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      setStats(await apiService.getStats());
    } catch { }
  }, []);

  useEffect(() => {
    fetchStats();
    socket.on("stats_update", setStats);
    return () => {
      socket.off("stats_update");
    };
  }, [fetchStats]);

  // Fetch job details on selection
  useEffect(() => {
    if (!selectedJobId) {
      setSelectedJobDetails(null);
      return;
    }
    let active = true;
    const loadDetails = async () => {
      try {
        const data = await apiService.getJobDetails(selectedJobId);
        if (active) {
          setSelectedJobDetails(data);
        }
      } catch { }
    };
    loadDetails();
    return () => {
      active = false;
    };
  }, [selectedJobId]);

  const handleSelectJob = (jobId: string) => {
    setSelectedJobId(jobId);
    setContentTab("detail");
  };

  const fetchAttempts = useCallback(async (reset = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setLoadingMore(true);
    try {
      const currentPage = reset ? 1 : Math.floor(attemptsRef.current.length / 15) + 1;
      const res = await apiService.getAttempts({ limit: 15, page: currentPage, search: debouncedSearch });
      const newAttempts = res.attempts || [];
      const pagination = res.pagination || {};
      setAttempts((prev) => {
        const nextVal = reset
          ? newAttempts
          : [...prev, ...newAttempts.filter((item: any) => !prev.some((p) => p.id === item.id))];
        attemptsRef.current = nextVal;
        return nextVal;
      });
      setHasMore(pagination.hasMore ?? false);
      setTotalAttempts(pagination.totalRecords || 0);
    } catch { } finally {
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
        setAttempts((prev) => {
          const exists = prev.some((a) => a.id === data.attempt.id);
          let nextVal;
          if (exists) {
            nextVal = prev.map((a) => (a.id === data.attempt.id ? data.attempt : a));
          } else {
            setTotalAttempts((t) => t + 1);
            nextVal = [data.attempt, ...prev];
          }
          attemptsRef.current = nextVal;
          return nextVal;
        });
      }

      // Handle details refresh if currently selected job gets updated
      if (selectedJobId && (data.job_id === selectedJobId || data.attempt?.job_id === selectedJobId)) {
        apiService.getJobDetails(selectedJobId).then(setSelectedJobDetails).catch(() => { });
      }
    };
    socket.on("job_update", handleEvent);
    return () => {
      socket.off("job_update", handleEvent);
    };
  }, [selectedJobId]);



  // Timing helper
  const tmCls = (ms: number | null, isExec: boolean) => {
    if (ms == null) return "";
    if (isExec) return ms < 300 ? "tm-fast" : ms < 1000 ? "tm-mid" : "tm-slow";
    return ms < 100 ? "tm-fast" : ms < 500 ? "tm-mid" : "tm-slow";
  };

  const formatTimeIST = (ms: number | string | null | undefined) => {
    if (ms == null) return "—";
    return new Date(ms).toLocaleTimeString("en-IN", {
      hour12: false,
      timeZone: "Asia/Kolkata",
    }) + " IST";
  };

  const elapsed = (ms: number | string | null | undefined) => {
    if (ms == null) return "—";
    const start = typeof ms === "string" ? new Date(ms).getTime() : ms;
    const s = Math.floor((now - start) / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    return `${m}m ${s % 60}s`;
  };

  const countdown = (ms: number | null) => {
    if (ms == null) return "—";
    const s = Math.floor((ms - now) / 1000);
    if (s <= 0) return "imminent";
    if (s < 60) return `in ${s}s`;
    const m = Math.floor(s / 60);
    return `in ${m}m ${s % 60}s`;
  };

  const t = stats?.jobs.total || 0;

  return (
    <>
      <div className="topbar">
        <div className="topbar-title">
          <span className="eyebrow">Pulsar</span>
          <span style={{ color: "var(--b2)" }}>·</span>
          Dashboard
        </div>
        <div className="topbar-sep"></div>
        <div className="tb-pill">v2.0</div>
        <div className="topbar-sep"></div>
        <div className="tb-live"><span className="live-dot"></span>Live</div>
        <div className="topbar-right">
          {(stats?.stuck_jobs_count || 0) > 0 && (
            <Tooltip text={`${stats!.stuck_jobs_count} stuck jobs`}>
              <div className="tb-icon warn">
                <i className="ti ti-alert-triangle"></i>
                <span className="badge-num">{stats!.stuck_jobs_count}</span>
              </div>
            </Tooltip>
          )}
          <Tooltip text="Refresh">
            <div className="tb-icon" onClick={fetchStats}><i className="ti ti-refresh"></i></div>
          </Tooltip>
        </div>
      </div>

      <div className="metric-rail">
        <div className="mc">
          <div className="mc-label">Total Jobs</div>
          <div className="mc-val">{t.toLocaleString()}</div>
          <div className="mc-sub">all time</div>
        </div>
        <div className="mc">
          <div className="mc-label">Processing</div>
          <div className="mc-val" style={{ color: "#7BA8FF" }}>{stats?.jobs.processing ?? 0}</div>
          <div className="mc-sub" style={{ color: "var(--blue)" }}>active now</div>
          <div className="mc-accent" style={{ background: "var(--blue)", opacity: 0.5 }}></div>
        </div>
        <div className="mc">
          <div className="mc-label">Pending</div>
          <div className="mc-val" style={{ color: "var(--t1)" }}>{stats?.jobs.pending ?? 0}</div>
          <div className="mc-sub">awaiting worker</div>
        </div>
        <div className="mc">
          <div className="mc-label">Delayed</div>
          <div className="mc-val" style={{ color: "var(--amber)" }}>{stats?.jobs.delayed ?? 0}</div>
          <div className="mc-sub">scheduled future</div>
          <div className="mc-accent" style={{ background: "var(--amber)", opacity: 0.35 }}></div>
        </div>
        <div className="mc">
          <div className="mc-label">Completed</div>
          <div className="mc-val" style={{ color: "var(--green)" }}>{stats?.jobs.completed ?? 0}</div>
          <div className="mc-sub">{t > 0 ? ((stats?.jobs.completed ?? 0) / t * 100).toFixed(1) : 0}% success</div>
          <div className="mc-accent" style={{ background: "var(--green)", opacity: 0.35 }}></div>
        </div>
        <div className="mc">
          <div className="mc-label">Failed</div>
          <div className="mc-val" style={{ color: "var(--red)" }}>{stats?.jobs.failed ?? 0}</div>
          <div className="mc-sub">{t > 0 ? ((stats?.jobs.failed ?? 0) / t * 100).toFixed(1) : 0}% · {stats?.stuck_jobs_count ?? 0} stuck</div>
          <div className="mc-accent" style={{ background: "var(--red)", opacity: 0.35 }}></div>
        </div>
      </div>

      {(stats?.stuck_jobs_count || 0) > 0 && (
        <div className="alert-ribbon">
          <i className="ti ti-alert-triangle"></i>
          <span><strong>{stats!.stuck_jobs_count} stuck jobs</strong> — pending 60s+ · possible worker capacity issue</span>
          <button className="ar-dismiss" onClick={(e) => (e.currentTarget.parentElement!.style.display = 'none')}><i className="ti ti-x"></i></button>
        </div>
      )}

      <div className="body-split">
        <div className="content-area" style={{ borderRight: "1px solid var(--b1)" }}>
          <div className="content-top">
            <span className={`content-tab ${contentTab === "detail" ? "on" : ""}`} onClick={() => setContentTab("detail")}>Job Detail</span>
            <span className={`content-tab ${contentTab === "log" ? "on" : ""}`} onClick={() => setContentTab("log")}>Execution Log</span>
          </div>

          <div className="detail-panel">
            {contentTab === "detail" && (
              <>
                {!selectedJobDetails ? (
                  <div className="empty-state">
                    <div className="empty-icon"><i className="ti ti-click"></i></div>
                    <div className="empty-label">Select a job to inspect</div>
                    <div className="empty-sub">Click any job row in the queue lanes</div>
                  </div>
                ) : (
                  <>
                    {/* HERO */}
                    <div className="detail-hero">
                      <div className={`detail-hero-icon`} style={
                        selectedJobDetails.job.status === "processing"
                          ? { background: "var(--blue-dim)", border: "1px solid var(--blue-ring)", color: "#7BA8FF" }
                          : selectedJobDetails.job.status === "pending"
                            ? { background: "var(--card3)", border: "1px solid var(--b2)", color: "var(--t2)" }
                            : selectedJobDetails.job.status === "delayed"
                              ? { background: "var(--amber-dim)", border: "1px solid var(--amber-ring)", color: "var(--amber)" }
                              : { background: "var(--red-dim)", border: "1px solid var(--red-ring)", color: "var(--red)" }
                      }>
                        <i className="ti ti-activity" style={{ fontSize: 17 }}></i>
                      </div>
                      <div className="detail-hero-body">
                        <div className="detail-type">{selectedJobDetails.job.job_type}</div>
                        <div className="detail-meta-row">
                          <span className={`status-badge-lg ${selectedJobDetails.job.status === "processing" ? "sb-proc" :
                              selectedJobDetails.job.status === "pending" ? "sb-pend" :
                                selectedJobDetails.job.status === "delayed" ? "sb-delay" : "sb-fail"
                            }`}>
                            <span className={`sb-dot ${selectedJobDetails.job.status === "processing" ? "pulse" : ""}`} style={{
                              background: selectedJobDetails.job.status === "processing" ? "#7BA8FF" :
                                selectedJobDetails.job.status === "pending" ? "var(--t3)" :
                                  selectedJobDetails.job.status === "delayed" ? "var(--amber)" : "var(--red)"
                            }}></span>
                            {selectedJobDetails.job.status}
                          </span>
                          <span className="detail-id">#{selectedJobDetails.job.id.slice(0, 8)}</span>
                          <span className="detail-queue-tag">{selectedJobDetails.job.queue_name}</span>
                          {(() => {
                            const latestAttempt = selectedJobDetails.attempts[selectedJobDetails.attempts.length - 1];
                            return (<>
                              {latestAttempt?.queue_latency_ms != null && (
                                <span className={`tm-chip ${tmCls(latestAttempt.queue_latency_ms, false)}`}>
                                  Q·wait {latestAttempt.queue_latency_ms}ms
                                </span>
                              )}
                              {latestAttempt?.execution_time_ms != null && (
                                <span className={`tm-chip ${tmCls(latestAttempt.execution_time_ms, true)}`}>
                                  Exec {latestAttempt.execution_time_ms}ms
                                </span>
                              )}
                              {selectedJobDetails.job.status === "processing" && latestAttempt?.started_at && (
                                <span className="tm-chip tm-live">Running {elapsed(latestAttempt.started_at)}</span>
                              )}
                            </>);
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* TABS CARD */}
                    <div className="d-card">
                      <div className="d-tabs">
                        <div className={`d-tab ${selectedTab === "details" ? "on" : ""}`} onClick={() => setSelectedTab("details")}>Details</div>
                        <div className={`d-tab ${selectedTab === "payload" ? "on" : ""}`} onClick={() => setSelectedTab("payload")}>Payload</div>
                        <div className={`d-tab ${selectedTab === "error" ? "on" : ""}`} style={selectedJobDetails.job.last_error ? { color: "var(--red)" } : {}} onClick={() => setSelectedTab("error")}>Error</div>
                      </div>

                      {/* DETAILS PANEL */}
                      <div className={`d-panel ${selectedTab === "details" ? "on" : ""}`}>
                        <div className="kv-grid-3">
                          <div className="kv-item"><div className="kv-k">Job ID</div><div className="kv-v" style={{ fontSize: 10.5 }}>{selectedJobDetails.job.id}</div></div>
                          <div className="kv-item"><div className="kv-k">Queue</div><div className="kv-v">{selectedJobDetails.job.queue_name}</div></div>
                          <div className="kv-item"><div className="kv-k">Attempt</div><div className="kv-v">#{selectedJobDetails.job.attempts} of {selectedJobDetails.job.max_attempts}</div></div>
                        </div>

                        <div style={{ margin: "14px 0 6px" }}>
                          <div className="kv-k" style={{ fontSize: 9.5, textTransform: "uppercase", letterSpacing: ".09em", color: "var(--t2)", marginBottom: 8 }}>Attempt history</div>
                          <div className="att-track">
                            {Array.from({ length: Math.max(selectedJobDetails.job.attempts || 0, 1) }).map((_, i) => {
                              const isCur = i === (selectedJobDetails.job.attempts || 1) - 1;
                              const col = selectedJobDetails.job.status === "failed" ? "var(--red)" : selectedJobDetails.job.status === "processing" ? "var(--blue)" : "var(--green)";
                              return <div key={i} className="att-pip" style={{ background: isCur ? col : "var(--b2)" }}></div>;
                            })}
                            <div className="att-pip" style={{ background: "var(--b1)" }}></div>
                            <div className="att-pip" style={{ background: "var(--b1)" }}></div>
                          </div>
                        </div>

                        {(() => {
                          const latestAttempt = selectedJobDetails.attempts[selectedJobDetails.attempts.length - 1];
                          return (
                            <div className="kv-grid-2" style={{ marginTop: 14 }}>
                              <div className="kv-item"><div className="kv-k">Scheduled</div><div className="kv-v">{latestAttempt ? formatTimeIST(latestAttempt.scheduled_at) : formatTimeIST(selectedJobDetails.job.run_at)}</div></div>
                              <div className="kv-item"><div className="kv-k">Started</div><div className="kv-v">{latestAttempt ? formatTimeIST(latestAttempt.started_at) : "—"}</div></div>
                              <div className="kv-item">
                                <div className="kv-k">Queue wait</div>
                                <div className="kv-v">
                                  <span className={latestAttempt ? tmCls(latestAttempt.queue_latency_ms, false) : ""}>
                                    {latestAttempt?.queue_latency_ms != null ? `${latestAttempt.queue_latency_ms}ms` : "—"}
                                  </span>
                                </div>
                              </div>
                              <div className="kv-item">
                                <div className="kv-k">Exec time</div>
                                <div className="kv-v">
                                  {latestAttempt?.execution_time_ms != null ? (
                                    <span className={tmCls(latestAttempt.execution_time_ms, true)}>
                                      {latestAttempt.execution_time_ms}ms
                                    </span>
                                  ) : selectedJobDetails.job.status === "processing" ? (
                                    <span className="tm-live">running…</span>
                                  ) : "—"}
                                </div>
                              </div>
                              <div className="kv-item"><div className="kv-k">Worker</div><div className="kv-v">{latestAttempt?.worker_id || "—"}</div></div>
                              <div className="kv-item">
                                <div className="kv-k">Host · PID</div>
                                <div className="kv-v">
                                  {latestAttempt?.worker_hostname || "—"} · {latestAttempt?.worker_pid || "—"}
                                </div>
                              </div>
                              {selectedJobDetails.job.status === "delayed" && (
                                <div className="kv-item"><div className="kv-k">Runs</div><div className="kv-v" style={{ color: "var(--amber)" }}>{countdown(selectedJobDetails.job.run_at)}</div></div>
                              )}
                              {selectedJobDetails.job.infra_attempts > 0 && (
                                <div className="kv-item"><div className="kv-k">Infra attempt</div><div className="kv-v">#{selectedJobDetails.job.infra_attempts}</div></div>
                              )}
                            </div>
                          );
                        })()}
                      </div>

                      {/* PAYLOAD PANEL */}
                      <div className={`d-panel ${selectedTab === "payload" ? "on" : ""}`}>
                        <div className="kv-k" style={{ fontSize: 9.5, textTransform: "uppercase", letterSpacing: ".09em", color: "var(--t2)", marginBottom: 10 }}>Input Payload</div>
                        <pre className="code-block">{JSON.stringify(selectedJobDetails.job.payload || {}, null, 2)}</pre>
                      </div>

                      {/* ERROR PANEL */}
                      <div className={`d-panel ${selectedTab === "error" ? "on" : ""}`}>
                        {selectedJobDetails.job.last_error ? (
                          <>
                            <div className="kv-k" style={{ fontSize: 9.5, textTransform: "uppercase", letterSpacing: ".09em", color: "var(--red)", marginBottom: 10 }}>Error Message</div>
                            <pre className="err-block">
                              {selectedJobDetails.job.last_error}
                              {selectedJobDetails.attempts[selectedJobDetails.attempts.length - 1]?.stack_trace ? `\n\n${selectedJobDetails.attempts[selectedJobDetails.attempts.length - 1].stack_trace}` : ""}
                            </pre>
                          </>
                        ) : (
                          <div style={{ color: "var(--t2)", fontSize: 12, padding: "8px 0" }}>No error recorded.</div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </>
            )}

            {contentTab === "log" && (
              <>
                {!selectedJobDetails ? (
                  <div className="empty-state">
                    <div className="empty-icon"><i className="ti ti-click"></i></div>
                    <div className="empty-label">Select a job to inspect</div>
                    <div className="empty-sub">Click any job row in the queue lanes</div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <div className="d-card-title" style={{ fontSize: 12, color: "var(--t0)" }}>
                      <i className="ti ti-receipt"></i> Execution Attempts Log for Job #{selectedJobDetails.job.id.slice(0, 8)}
                    </div>
                    {selectedJobDetails.attempts.length === 0 ? (
                      <div style={{ color: "var(--t2)", fontSize: 12, padding: "8px 0" }}>No execution attempts recorded yet.</div>
                    ) : (
                      selectedJobDetails.attempts.map((att, index) => (
                        <div key={att.id} className="d-card" style={{ borderLeft: att.status === "failed" ? "3px solid var(--red)" : att.status === "completed" ? "3px solid var(--green)" : "3px solid var(--blue)" }}>
                          <div className="d-card-head" style={{ padding: "10px 14px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span className="mini-badge" style={{ background: "var(--card3)", color: "var(--t1)", border: "1px solid var(--b2)" }}>
                                Attempt #{att.business_attempt}{att.infra_attempt > 0 ? ` (Infra #${att.infra_attempt})` : ""}
                              </span>
                              <span className={`mini-badge ${att.status === "completed" ? "mb-done" : att.status === "failed" ? "mb-fail" : "mb-proc"
                                }`}>{att.status}</span>
                            </div>
                            <span style={{ fontSize: 10, color: "var(--t2)", fontFamily: "var(--mono)" }}>ID: {att.id.slice(0, 8)}</span>
                          </div>
                          <div className="d-card-body" style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
                            <div className="kv-grid-3">
                              <div className="kv-item"><div className="kv-k" style={{ fontSize: 8.5 }}>Started At</div><div className="kv-v" style={{ fontSize: 11 }}>{formatTimeIST(att.started_at)}</div></div>
                              <div className="kv-item"><div className="kv-k" style={{ fontSize: 8.5 }}>Finished At</div><div className="kv-v" style={{ fontSize: 11 }}>{formatTimeIST(att.finished_at)}</div></div>
                              <div className="kv-item"><div className="kv-k" style={{ fontSize: 8.5 }}>Exec Duration</div><div className="kv-v" style={{ fontSize: 11 }}>{att.execution_time_ms != null ? `${att.execution_time_ms}ms` : "—"}</div></div>
                            </div>
                            <div className="kv-grid-2">
                              <div className="kv-item"><div className="kv-k" style={{ fontSize: 8.5 }}>Worker Node</div><div className="kv-v" style={{ fontSize: 11 }}>{att.worker_id} ({att.worker_hostname || "local"})</div></div>
                              <div className="kv-item"><div className="kv-k" style={{ fontSize: 8.5 }}>Queue Latency</div><div className="kv-v" style={{ fontSize: 11 }}>{att.queue_latency_ms != null ? `${att.queue_latency_ms}ms` : "—"}</div></div>
                            </div>
                            {att.error && (
                              <div style={{ marginTop: 8 }}>
                                <div className="kv-k" style={{ fontSize: 8.5, color: "var(--red)" }}>Execution Error</div>
                                <pre className="err-block" style={{ marginTop: 4 }}>
                                  {att.error}
                                  {att.stack_trace ? `\n\n${att.stack_trace}` : ""}
                                </pre>
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </>
            )}

            {/* Worker map panel removed */}
          </div>
        </div>

        <div className="lanes-panel">
          <div className="lanes-header">
            <span className="lanes-header-label"><i className="ti ti-stack-2"></i>Queue Lanes</span>

          </div>
          <div className="lanes-scroll" id="lanes-scroll">
            <QueueLanes
              queues={stats?.queues}
              now={now}
              selectedJobId={selectedJobId}
              onSelectJob={handleSelectJob}
            />
          </div>
        </div>

        <div className="metrics-sidebar">
          <DistributionBar total={t} stats={stats} />
          <PerformanceMetrics throughput={stats?.throughput_last_60s ?? 0} stats={stats} />
          <OutboxPanel outbox={stats?.outbox ?? { total: 0, pending: 0, processed: 0, failed: 0 }} />
          <SeedJobs onSeeded={fetchStats} />
        </div>
      </div>

      <div className="execution-feed-row">
        <ExecutionHistory
          attempts={attempts}
          totalAttempts={totalAttempts}
          feedSearch={feedSearch}
          setFeedSearch={setFeedSearch}
          expandedIds={expandedIds}
          toggleExpand={(id) => setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }))}
          feedRef={feedRef}
          loadMore={loadMore}
          hasMore={hasMore}
          loadingMore={loadingMore}
        />
      </div>
    </>
  );
}
