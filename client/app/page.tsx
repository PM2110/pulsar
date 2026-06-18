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
  const [contentTab, setContentTab] = useState<"detail" | "log" | "map">("detail");

  // Worker Map State
  const [workers, setWorkers] = useState<any[]>([]);
  const [spawnQueue, setSpawnQueue] = useState("default");
  const [spawnAutoRestart, setSpawnAutoRestart] = useState(true);

  // Refresh clock
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      setStats(await apiService.getStats());
    } catch {}
  }, []);

  // Fetch workers
  const fetchWorkers = useCallback(async () => {
    try {
      const res = await apiService.getWorkers();
      setWorkers(res.workers || []);
    } catch {}
  }, []);

  useEffect(() => {
    fetchStats();
    fetchWorkers();
    socket.on("stats_update", setStats);
    return () => {
      socket.off("stats_update");
    };
  }, [fetchStats, fetchWorkers]);

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
      } catch {}
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
    } catch {} finally {
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
        apiService.getJobDetails(selectedJobId).then(setSelectedJobDetails).catch(() => {});
      }

      // Handle worker update event
      if (data.type === "worker_update") {
        fetchWorkers();
      }
    };
    socket.on("job_update", handleEvent);
    return () => {
      socket.off("job_update", handleEvent);
    };
  }, [selectedJobId, fetchWorkers]);

  // Worker Spawn Action
  const handleSpawnWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = `w-${spawnQueue}-${Math.random().toString(36).substring(2, 6)}`;
    try {
      await apiService.startWorker({
        queue_name: spawnQueue,
        worker_id: id,
        auto_restart: spawnAutoRestart,
      });
      fetchWorkers();
    } catch {}
  };

  const handleStopWorker = async (wId: string) => {
    try {
      await apiService.stopWorker(wId);
      fetchWorkers();
    } catch {}
  };

  const handleCrashWorker = async (wId: string) => {
    try {
      await apiService.crashWorker(wId);
      fetchWorkers();
    } catch {}
  };

  const handleDeleteWorker = async (wId: string) => {
    try {
      await apiService.deleteWorker(wId);
      fetchWorkers();
    } catch {}
  };

  const handleToggleWorkerSetting = async (wId: string, updates: { auto_restart?: boolean; adaptive_scaling?: boolean }) => {
    try {
      await apiService.updateWorkerSettings(wId, updates);
      fetchWorkers();
    } catch {}
  };

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
            <div className="tb-icon warn" title={`${stats!.stuck_jobs_count} stuck jobs`}>
              <i className="ti ti-alert-triangle"></i>
              <span className="badge-num">{stats!.stuck_jobs_count}</span>
            </div>
          )}
          <div className="tb-icon" title="Refresh" onClick={fetchStats}><i className="ti ti-refresh"></i></div>
          <div className="tb-icon" title="Filter"><i className="ti ti-filter"></i></div>
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
            <span className={`content-tab ${contentTab === "map" ? "on" : ""}`} onClick={() => setContentTab("map")}>Worker Map</span>
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
                          <span className={`status-badge-lg ${
                            selectedJobDetails.job.status === "processing" ? "sb-proc" :
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
                          {selectedJobDetails.attempts.length > 0 && selectedJobDetails.attempts[0].queue_latency_ms != null && (
                            <span className={`tm-chip ${tmCls(selectedJobDetails.attempts[0].queue_latency_ms, false)}`}>
                              Q·wait {selectedJobDetails.attempts[0].queue_latency_ms}ms
                            </span>
                          )}
                          {selectedJobDetails.attempts.length > 0 && selectedJobDetails.attempts[0].execution_time_ms != null && (
                            <span className={`tm-chip ${tmCls(selectedJobDetails.attempts[0].execution_time_ms, true)}`}>
                              Exec {selectedJobDetails.attempts[0].execution_time_ms}ms
                            </span>
                          )}
                          {selectedJobDetails.job.status === "processing" && selectedJobDetails.attempts[0]?.started_at && (
                            <span className="tm-chip tm-live">Running {elapsed(selectedJobDetails.attempts[0].started_at)}</span>
                          )}
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

                        <div className="kv-grid-2" style={{ marginTop: 14 }}>
                          <div className="kv-item"><div className="kv-k">Scheduled</div><div className="kv-v">{formatTimeIST(selectedJobDetails.job.run_at)}</div></div>
                          <div className="kv-item"><div className="kv-k">Started</div><div className="kv-v">{selectedJobDetails.attempts[0] ? formatTimeIST(selectedJobDetails.attempts[0].started_at) : "—"}</div></div>
                          <div className="kv-item">
                            <div className="kv-k">Queue wait</div>
                            <div className="kv-v">
                              <span className={selectedJobDetails.attempts[0] ? tmCls(selectedJobDetails.attempts[0].queue_latency_ms, false) : ""}>
                                {selectedJobDetails.attempts[0] && selectedJobDetails.attempts[0].queue_latency_ms != null ? `${selectedJobDetails.attempts[0].queue_latency_ms}ms` : "—"}
                              </span>
                            </div>
                          </div>
                          <div className="kv-item">
                            <div className="kv-k">Exec time</div>
                            <div className="kv-v">
                              {selectedJobDetails.attempts[0] && selectedJobDetails.attempts[0].execution_time_ms != null ? (
                                <span className={tmCls(selectedJobDetails.attempts[0].execution_time_ms, true)}>
                                  {selectedJobDetails.attempts[0].execution_time_ms}ms
                                </span>
                              ) : selectedJobDetails.job.status === "processing" ? (
                                <span className="tm-live">running…</span>
                              ) : "—"}
                            </div>
                          </div>
                          <div className="kv-item"><div className="kv-k">Worker</div><div className="kv-v">{selectedJobDetails.attempts[0]?.worker_id || "—"}</div></div>
                          <div className="kv-item">
                            <div className="kv-k">Host · PID</div>
                            <div className="kv-v">
                              {selectedJobDetails.attempts[0]?.worker_hostname || "—"} · {selectedJobDetails.attempts[0]?.worker_pid || "—"}
                            </div>
                          </div>
                          {selectedJobDetails.job.status === "delayed" && (
                            <div className="kv-item"><div className="kv-k">Runs</div><div className="kv-v" style={{ color: "var(--amber)" }}>{countdown(selectedJobDetails.job.run_at)}</div></div>
                          )}
                          {selectedJobDetails.job.infra_attempts > 0 && (
                            <div className="kv-item"><div className="kv-k">Infra attempt</div><div className="kv-v">#{selectedJobDetails.job.infra_attempts}</div></div>
                          )}
                        </div>
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
                              {selectedJobDetails.attempts[0]?.stack_trace ? `\n\n${selectedJobDetails.attempts[0].stack_trace}` : ""}
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
                                Attempt #{selectedJobDetails.attempts.length - index}
                              </span>
                              <span className={`mini-badge ${
                                att.status === "completed" ? "mb-done" : att.status === "failed" ? "mb-fail" : "mb-proc"
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

            {contentTab === "map" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {/* Spawn Worker Container */}
                <form className="wm-form" onSubmit={handleSpawnWorker}>
                  <div className="wm-form-label" style={{ fontSize: 11, color: "var(--t0)", fontWeight: 600 }}>
                    <i className="ti ti-cpu" style={{ marginRight: 6 }}></i> Spawn a New Worker Node
                  </div>
                  <div className="wm-form-row">
                    <div className="wm-form-group">
                      <div className="wm-form-label">Target Queue</div>
                      <select
                        className="seed-sel"
                        style={{ marginBottom: 0 }}
                        value={spawnQueue}
                        onChange={(e) => setSpawnQueue(e.target.value)}
                      >
                        <option value="default">Default</option>
                        <option value="notifications">Notifications</option>
                        <option value="media">Media</option>
                      </select>
                    </div>
                    <div className="wm-form-group" style={{ flex: "0 0 auto", paddingBottom: 10 }}>
                      <div className="wm-setting-row" style={{ gap: 8 }}>
                        <span className="wm-form-label">Auto-Restart</span>
                        <label className="wm-switch">
                          <input
                            type="checkbox"
                            checked={spawnAutoRestart}
                            onChange={(e) => setSpawnAutoRestart(e.target.checked)}
                          />
                          <span className="wm-slider"></span>
                        </label>
                      </div>
                    </div>
                    <button type="submit" className="seed-btn primary" style={{ height: 32, padding: "0 16px" }}>
                      Spawn Worker
                    </button>
                  </div>
                </form>

                {/* Worker Grid */}
                <div>
                  <div className="wm-form-label" style={{ marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>Active Clusters / Registry ({workers.length} nodes)</span>
                    <button className="wm-btn" style={{ padding: "3px 8px", width: "auto" }} onClick={fetchWorkers}>
                      <i className="ti ti-refresh" style={{ fontSize: 10 }}></i> Refresh Grid
                    </button>
                  </div>

                  {workers.length === 0 ? (
                    <div className="empty-state" style={{ padding: "40px 0" }}>
                      <div className="empty-icon"><i className="ti ti-cpu-off"></i></div>
                      <div className="empty-label">No registered workers found</div>
                      <div className="empty-sub">Use the panel above to spawn a new worker.</div>
                    </div>
                  ) : (
                    <div className="wm-grid">
                      {workers.map((w) => {
                        const isStale = now - new Date(w.last_activity).getTime() >= 30000;
                        const status = w.status === "stopped" ? "stopped" : isStale ? "stale" : w.status;

                        return (
                          <div key={w.worker_id} className="wm-card" style={{ opacity: status === "stopped" ? 0.6 : 1 }}>
                            <div className="wm-card-head">
                              <div className="wm-card-title">
                                <span className="wm-card-id" title={w.worker_id}>
                                  {w.worker_id.startsWith("api-") ? "API Node" : "Worker"} · {w.worker_id.split("-").pop()}
                                </span>
                                <span className="wm-card-queue">{w.queue_name}</span>
                              </div>
                              <span className={`wm-status-badge ${
                                status === "processing" ? "wms-proc" :
                                status === "idle" ? "wms-idle" : "wms-stop"
                              }`}>
                                <span className={`sb-dot ${status === "processing" ? "pulse" : ""}`} style={{
                                  background: status === "processing" ? "#7BA8FF" :
                                              status === "idle" ? "#5DD1A0" :
                                              status === "stale" ? "var(--amber)" : "var(--t3)"
                                }}></span>
                                {status}
                              </span>
                            </div>

                            <div className="wm-card-metrics">
                              <div className="wm-metric-item">
                                <span className="wm-metric-lbl">Processed</span>
                                <span className="wm-metric-val">{w.jobs_processed}</span>
                              </div>
                              <div className="wm-metric-item">
                                <span className="wm-metric-lbl">Failed</span>
                                <span className="wm-metric-val" style={w.jobs_failed > 0 ? { color: "var(--red)" } : {}}>{w.jobs_failed}</span>
                              </div>
                            </div>

                            <div className="wm-settings">
                              <div className="wm-setting-row">
                                <span>Auto Restart</span>
                                <label className="wm-switch">
                                  <input
                                    type="checkbox"
                                    checked={w.auto_restart}
                                    onChange={(e) => handleToggleWorkerSetting(w.worker_id, { auto_restart: e.target.checked })}
                                  />
                                  <span className="wm-slider"></span>
                                </label>
                              </div>
                              <div className="wm-setting-row">
                                <span>Adaptive Scaling</span>
                                <label className="wm-switch">
                                  <input
                                    type="checkbox"
                                    checked={w.adaptive_scaling}
                                    onChange={(e) => handleToggleWorkerSetting(w.worker_id, { adaptive_scaling: e.target.checked })}
                                  />
                                  <span className="wm-slider"></span>
                                </label>
                              </div>
                              <div className="wm-setting-row" style={{ fontSize: 9, color: "var(--t3)", fontFamily: "var(--mono)", marginTop: 4 }}>
                                Last seen: {elapsed(w.last_activity)} ago
                              </div>
                            </div>

                            <div className="wm-actions">
                              {w.status !== "stopped" ? (
                                <>
                                  <button className="wm-btn" onClick={() => handleStopWorker(w.worker_id)}>
                                    <i className="ti ti-player-pause"></i> Stop
                                  </button>
                                  <button className="wm-btn danger" onClick={() => handleCrashWorker(w.worker_id)}>
                                    <i className="ti ti-activity-heartbeat"></i> Crash
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button className="wm-btn" onClick={() => apiService.startWorker({ queue_name: w.queue_name, worker_id: w.worker_id, auto_restart: w.auto_restart }).then(fetchWorkers)}>
                                    <i className="ti ti-player-play"></i> Start
                                  </button>
                                  <button className="wm-btn danger" onClick={() => handleDeleteWorker(w.worker_id)}>
                                    <i className="ti ti-trash"></i> Delete
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="lanes-panel">
          <div className="lanes-header">
            <span className="lanes-header-label"><i className="ti ti-stack-2"></i>Queue Lanes</span>
            <div style={{ display: "flex", gap: 5 }}>
              <div className="tb-icon" style={{ width: 24, height: 24, fontSize: 12 }} title="Expand all"><i className="ti ti-arrows-maximize"></i></div>
              <div className="tb-icon" style={{ width: 24, height: 24, fontSize: 12 }} title="Collapse all"><i className="ti ti-arrows-minimize"></i></div>
            </div>
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
          <SeedJobs onSeeded={fetchStats} />
        </div>
      </div>
    </>
  );
}
