"use client";

import React, { useState, useEffect } from "react";
import { useJobs } from "../hooks/useJobs";
import { AddJobDrawer } from "../components/jobs/AddJobDrawer";
import { apiService, socket } from "../lib/api.service";
import { formatTime } from "../lib/utils";
import { Job, JobAttempt } from "../types";
import type { SortOrder } from "../components/ui";
import { SearchBar } from "../components/ui/SearchBar";
import { Dropdown } from "../components/ui/Dropdown";
import { Tooltip } from "../components/ui/Tooltip";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";

const QUEUES = ["notifications", "media", "default"];
const LIMIT = 10;

const JobsPage = () => {
  const {
    jobs, total, page, setPage, statusFilter, setStatusFilter,
    queueFilter, setQueueFilter, sort, setSort, loading, fetchJobs,
  } = useJobs(LIMIT);

  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [attempts, setAttempts] = useState<JobAttempt[]>([]);
  const [loadingAttempts, setLoadingAttempts] = useState(false);
  const [expandedAttempts, setExpandedAttempts] = useState<Record<string, boolean>>({});
  const [showAddDrawer, setShowAddDrawer] = useState(false);
  const [search, setSearch] = useState("");
  const [stats, setStats] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; type: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Subscribe to real-time stats updates
  useEffect(() => {
    apiService.getStats().then(setStats).catch(() => { });
    socket.on("stats_update", setStats);
    return () => {
      socket.off("stats_update");
    };
  }, []);

  // Fetch detailed job attempts when a job is focused
  useEffect(() => {
    if (!selectedJob?.id) {
      setAttempts([]);
      setExpandedAttempts({});
      return;
    }

    let active = true;
    setLoadingAttempts(true);

    apiService.getJobDetails(selectedJob.id)
      .then((res) => {
        if (!active) return;
        const fetchedAttempts = res.attempts || [];
        setAttempts(fetchedAttempts);

        // Expand the most recent attempt by default
        if (fetchedAttempts.length > 0) {
          const latest = fetchedAttempts[fetchedAttempts.length - 1];
          setExpandedAttempts({ [latest.id]: true });
        } else {
          setExpandedAttempts({});
        }
      })
      .catch((err) => {
        console.error("Failed to load job details:", err);
      })
      .finally(() => {
        if (active) {
          setLoadingAttempts(false);
        }
      });

    return () => {
      active = false;
    };
  }, [selectedJob?.id]);

  const toggleAttempt = (id: string) => {
    setExpandedAttempts(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const deleteJob = (id: string, type: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirm({ id, type });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      await apiService.deleteJob(deleteConfirm.id);
      fetchJobs();
      if (selectedJob?.id === deleteConfirm.id) setSelectedJob(null);
    } finally {
      setDeleting(false);
      setDeleteConfirm(null);
    }
  };

  const retryJob = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await apiService.retryJob(id);
    fetchJobs();
  };

  const handleSort = (key: string, order: SortOrder) => {
    setSort({ key, order });
    setPage(0);
  };

  const handleSortClick = (key: string) => {
    let order: SortOrder = "asc";
    if (sort && sort.key === key) {
      order = sort.order === "asc" ? "desc" : "asc";
    }
    handleSort(key, order);
  };

  const handleClear = () => {
    setStatusFilter([]);
    setQueueFilter([]);
    setSearch("");
    setSort(undefined);
    setPage(0);
  };

  const handlePrevPage = () => {
    if (page > 0) setPage(page - 1);
  };

  const handleNextPage = () => {
    const endIdx = Math.min((page + 1) * LIMIT, total);
    if (endIdx < total) setPage(page + 1);
  };

  const filteredJobs = search
    ? jobs.filter(j =>
      j.job_type.toLowerCase().includes(search.toLowerCase()) ||
      j.id.includes(search) ||
      j.queue_name.toLowerCase().includes(search.toLowerCase())
    )
    : jobs;

  // Keep selected job reference updated when the jobs list changes
  const currentSelectedJob = selectedJob
    ? jobs.find(j => j.id === selectedJob.id) || selectedJob
    : null;

  const renderSortIcon = (key: string) => {
    if (!sort || sort.key !== key) {
      return <i className="ti ti-arrows-sort sort-ico"></i>;
    }
    return sort.order === "asc" ? (
      <i className="ti ti-chevron-up sort-ico"></i>
    ) : (
      <i className="ti ti-chevron-down sort-ico"></i>
    );
  };

  const renderAttemptsMatrix = (job: Job) => {
    return (
      <div className="attempts-matrix">
        {Array.from({ length: job.max_attempts }).map((_, i) => {
          let dotClass = "empty";
          if (job.status === "processing" && i === job.attempts - 1) {
            dotClass = "current-run";
          } else if (i < job.attempts) {
            dotClass = job.status === "completed" ? "done-ok" : "done-fail";
          }
          return <div key={i} className={`att-dot ${dotClass}`}></div>;
        })}
        <span style={{ fontSize: 10, color: "var(--t2)", marginLeft: 4 }}>
          {job.attempts}/{job.max_attempts}
        </span>
      </div>
    );
  };

  const startIdx = page * LIMIT + 1;
  const endIdx = Math.min((page + 1) * LIMIT, total);

  return (
    <>
      {/* Topbar */}
      <div className="topbar">
        <div className="topbar-title">
          <span className="eyebrow">Pulsar</span>
          <span style={{ color: "var(--b2)" }}>·</span>
          Jobs Workspace
        </div>
        <div className="topbar-sep"></div>
        <div className="tb-pill">v2.0</div>

        <div className="topbar-right">
          <button className="btn-action btn-primary" onClick={() => setShowAddDrawer(true)}>
            <i className="ti ti-plus"></i>Add Job
          </button>
        </div>
      </div>

      {/* Metric Rail matching */}
      <div className="metric-rail">
        <div className="mc">
          <div className="mc-label">Total Jobs</div>
          <div className="mc-val">{(stats?.jobs.total ?? total).toLocaleString()}</div>
          <div className="mc-sub">filtered: {total}</div>
        </div>
        <div className="mc">
          <div className="mc-label">Processing</div>
          <div className="mc-val" style={{ color: "#7BA8FF" }}>
            {stats?.jobs.processing ?? 0}
          </div>
          <div className="mc-sub" style={{ color: "var(--blue)" }}>active now</div>
          <div className="mc-accent" style={{ background: "var(--blue)", opacity: 0.5 }}></div>
        </div>
        <div className="mc">
          <div className="mc-label">Pending</div>
          <div className="mc-val" style={{ color: "var(--t1)" }}>
            {stats?.jobs.pending ?? 0}
          </div>
          <div className="mc-sub">awaiting worker</div>
        </div>
        <div className="mc">
          <div className="mc-label">Delayed</div>
          <div className="mc-val" style={{ color: "var(--amber)" }}>
            {stats?.jobs.delayed ?? 0}
          </div>
          <div className="mc-sub">scheduled future</div>
          <div className="mc-accent" style={{ background: "var(--amber)", opacity: 0.35 }}></div>
        </div>
        <div className="mc">
          <div className="mc-label">Completed</div>
          <div className="mc-val" style={{ color: "var(--green)" }}>
            {stats?.jobs.completed ?? 0}
          </div>
          <div className="mc-sub">completed jobs</div>
          <div className="mc-accent" style={{ background: "var(--green)", opacity: 0.35 }}></div>
        </div>
        <div className="mc">
          <div className="mc-label">Failed</div>
          <div className="mc-val" style={{ color: "var(--red)" }}>
            {stats?.jobs.failed ?? 0}
          </div>
          <div className="mc-sub">failed retry candidates</div>
          <div className="mc-accent" style={{ background: "var(--red)", opacity: 0.35 }}></div>
        </div>
      </div>

      {/* Controls Section */}
      <div className="controls-section">
        <SearchBar
          placeholder="Search by type, ID, or queue..."
          value={search}
          onChange={setSearch}
          debounceMs={0}
          style={{ flex: "0 0 280px" }}
        />

        <Dropdown
          options={[
            { label: "Pending", value: "pending" },
            { label: "Processing", value: "processing" },
            { label: "Completed", value: "completed" },
            { label: "Failed", value: "failed" },
          ]}
          placeholder="All Statuses"
          value={statusFilter}
          onChange={(val) => {
            setStatusFilter(val);
            setPage(0);
          }}
          multiSelect={true}
          style={{ width: 160 }}
        />

        <Dropdown
          options={QUEUES.map((q) => ({ label: q.charAt(0).toUpperCase() + q.slice(1), value: q }))}
          placeholder="All Queues"
          value={queueFilter}
          onChange={(val) => {
            setQueueFilter(val);
            setPage(0);
          }}
          multiSelect={true}
          style={{ width: 160 }}
        />

        <button className="btn-action" onClick={handleClear}>
          Clear
        </button>
        <div style={{ flex: 1 }}></div>
        <button className="btn-action" onClick={fetchJobs}>
          <i className="ti ti-refresh"></i>Refresh
        </button>
      </div>

      {/* Body split */}
      <div className="body-split">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th
                  onClick={() => handleSortClick("id")}
                  className={sort?.key === "id" ? "sorted" : ""}
                  style={{ width: 110 }}
                >
                  ID {renderSortIcon("id")}
                </th>
                <th
                  onClick={() => handleSortClick("job_type")}
                  className={sort?.key === "job_type" ? "sorted" : ""}
                >
                  Type {renderSortIcon("job_type")}
                </th>
                <th
                  onClick={() => handleSortClick("queue_name")}
                  className={sort?.key === "queue_name" ? "sorted" : ""}
                >
                  Queue {renderSortIcon("queue_name")}
                </th>
                <th
                  onClick={() => handleSortClick("status")}
                  className={sort?.key === "status" ? "sorted" : ""}
                >
                  Status {renderSortIcon("status")}
                </th>
                <th
                  onClick={() => handleSortClick("priority")}
                  className={sort?.key === "priority" ? "sorted" : ""}
                  style={{ width: 80 }}
                >
                  Priority {renderSortIcon("priority")}
                </th>
                <th style={{ width: 140 }}>Attempts</th>
                <th
                  onClick={() => handleSortClick("failure_mode")}
                  className={sort?.key === "failure_mode" ? "sorted" : ""}
                >
                  Failure Mode {renderSortIcon("failure_mode")}
                </th>
                <th
                  onClick={() => handleSortClick("created_at")}
                  className={sort?.key === "created_at" ? "sorted" : ""}
                >
                  Created At {renderSortIcon("created_at")}
                </th>
                <th style={{ width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {filteredJobs.map((job) => (
                <tr
                  key={job.id}
                  className={currentSelectedJob?.id === job.id ? "selected-row" : ""}
                  onClick={() => setSelectedJob(job)}
                >
                  <td className="text-dim-mono">
                    <Tooltip text={`Full ID: ${job.id}`}>
                      <span>#{job.id.slice(0, 8)}</span>
                    </Tooltip>
                  </td>
                  <td className="text-primary-heavy">{job.job_type}</td>
                  <td>
                    <span className="badge-chip">{job.queue_name}</span>
                  </td>
                  <td>
                    <span className={`status-badge s-${job.status}`}>{job.status}</span>
                  </td>
                  <td className="text-priority">{job.priority}</td>
                  <td>{renderAttemptsMatrix(job)}</td>
                  <td style={{ fontSize: 11 }}>
                    {job.failure_mode}
                    {job.fail_probability != null &&
                      ` (${Math.round(job.fail_probability * 100)}%)`}
                  </td>
                  <td style={{ fontSize: 11 }}>{formatTime(job.created_at)}</td>
                  <td>
                    <div className="row-actions">
                      {job.status === "failed" && (
                        <Tooltip text="Retry Job">
                          <button
                            className="btn-tool tool-retry"
                            onClick={(e) => retryJob(job.id, e)}
                          >
                            <i className="ti ti-refresh"></i>
                          </button>
                        </Tooltip>
                      )}
                      <Tooltip text="Delete Job">
                        <button
                          className="btn-tool"
                          onClick={(e) => deleteJob(job.id, job.job_type, e)}
                        >
                          <i className="ti ti-x"></i>
                        </button>
                      </Tooltip>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filteredJobs.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ textAlign: "center", color: "var(--t2)", padding: 40 }}>
                    No jobs matching current filter bounds
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {/* Side Panel for Job Telemetry */}
        <div className="detail-side-panel">
          {!currentSelectedJob ? (
            <div className="panel-empty">
              <i className="ti ti-current-loop"></i>
              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--t1)" }}>
                No Job Selected
              </div>
              <div style={{ fontSize: 11 }}>
                Select a job from the list to view details.
              </div>
            </div>
          ) : (
            <>
              <div className="panel-top">
                <span className="panel-title">Job Details</span>
                <button className="btn-tool" onClick={() => setSelectedJob(null)}>
                  <i className="ti ti-x"></i>
                </button>
              </div>
              <div className="panel-scroll">
                <div className="hero-card">
                  <div className={`hero-icon i-${currentSelectedJob.status}`}>
                    <i className="ti ti-activity"></i>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "var(--t0)", marginBottom: 4 }}>
                      {currentSelectedJob.job_type}
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <span className={`status-badge s-${currentSelectedJob.status}`} style={{ fontSize: 10, padding: "1px 5px" }}>
                        {currentSelectedJob.status.toUpperCase()}
                      </span>
                      <span className="text-dim-mono">#{currentSelectedJob.id.slice(0, 12)}</span>
                    </div>
                  </div>
                </div>

                <div className="meta-card">
                  <div className="meta-head">Metadata Core</div>
                  <div className="meta-body">
                    <div className="kv-grid">
                      <div>
                        <div className="kv-lbl">Queue</div>
                        <div className="kv-val">{currentSelectedJob.queue_name}</div>
                      </div>
                      <div>
                        <div className="kv-lbl">Priority</div>
                        <div className="kv-val text-priority">{currentSelectedJob.priority}/10</div>
                      </div>
                      <div>
                        <div className="kv-lbl">Attempts</div>
                        <div className="kv-val">
                          {currentSelectedJob.attempts} / {currentSelectedJob.max_attempts} Max
                        </div>
                      </div>
                      <div>
                        <div className="kv-lbl">Created At</div>
                        <div className="kv-val">{formatTime(currentSelectedJob.created_at)}</div>
                      </div>
                      <div>
                        <div className="kv-lbl">Failure Mode</div>
                        <div className="kv-val" style={{ fontSize: 11 }}>
                          {currentSelectedJob.failure_mode}
                        </div>
                      </div>
                      <div>
                        <div className="kv-lbl">Failure Probability</div>
                        <div className="kv-val">
                          {currentSelectedJob.fail_probability != null
                            ? `${Math.round(currentSelectedJob.fail_probability * 100)}%`
                            : "0%"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="meta-card">
                  <div className="meta-head">Execution Attempts</div>
                  <div className="meta-body">
                    {loadingAttempts ? (
                      <div style={{ fontSize: 11, color: "var(--t2)", display: "flex", gap: 6, alignItems: "center" }}>
                        <i className="ti ti-loader" style={{ animation: "spin 1s linear infinite" }}></i>
                        Loading execution attempts...
                      </div>
                    ) : attempts.length === 0 ? (
                      <div style={{ fontSize: 11, color: "var(--t2)" }}>
                        No attempts recorded for this job.
                      </div>
                    ) : (
                      <div className="attempts-timeline">
                        {attempts.map((att) => {
                          const isExpanded = !!expandedAttempts[att.id];
                          const hasErr = !!att.error;

                          let statusDotClass = "empty";
                          if (att.status === "completed") {
                            statusDotClass = "done-ok";
                          } else if (att.status === "failed") {
                            statusDotClass = "done-fail";
                          } else if (att.status === "processing") {
                            statusDotClass = "current-run";
                          }

                          return (
                            <div key={att.id} className={`attempt-card ${isExpanded ? 'expanded' : ''}`}>
                              <div className="attempt-header" onClick={() => toggleAttempt(att.id)}>
                                <div className="attempt-header-left">
                                  <div className={`att-dot ${statusDotClass}`}></div>
                                  <span className="attempt-title">
                                    Attempt #{att.business_attempt}
                                    {att.infra_attempt > 0 && ` (Infra #${att.infra_attempt})`}
                                  </span>
                                  <span className="attempt-subtitle">
                                    {att.execution_time_ms ? `· ${att.execution_time_ms}ms` : ''}
                                  </span>
                                </div>
                                <i className={`ti ${isExpanded ? 'ti-chevron-up' : 'ti-chevron-down'}`} style={{ fontSize: 11, color: "var(--t2)" }}></i>
                              </div>
                              {isExpanded && (
                                <div className="attempt-details">
                                  <div className="attempt-grid">
                                    <div>
                                      <div className="kv-lbl">Worker ID</div>
                                      <div className="kv-val mono">{att.worker_id.slice(0, 12)}</div>
                                    </div>
                                    <div>
                                      <div className="kv-lbl">Status</div>
                                      <div className="kv-val" style={{ textTransform: "capitalize" }}>{att.status}</div>
                                    </div>
                                    <div>
                                      <div className="kv-lbl">Started At</div>
                                      <div className="kv-val">{formatTime(att.started_at)}</div>
                                    </div>
                                    <div>
                                      <div className="kv-lbl">Finished At</div>
                                      <div className="kv-val">{att.finished_at ? formatTime(att.finished_at) : 'N/A'}</div>
                                    </div>
                                  </div>
                                  {hasErr && (
                                    <div>
                                      <div className="kv-lbl" style={{ color: "var(--red)", marginTop: 4 }}>Failure Reason</div>
                                      <div className="attempt-err">{att.error}</div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {currentSelectedJob.last_error && (
                  <div className="meta-card">
                    <div className="meta-head" style={{ color: "var(--red)" }}>
                      Execution Core Error
                    </div>
                    <div className="meta-body">
                      <div
                        className="code-box"
                        style={{
                          color: "var(--red)",
                          borderColor: "var(--red-ring)",
                          background: "var(--red-dim)",
                        }}
                      >
                        {currentSelectedJob.last_error}
                      </div>
                    </div>
                  </div>
                )}

                <div className="meta-card">
                  <div className="meta-head">Immutable Payload Object</div>
                  <div className="meta-body">
                    <div className="code-box">
                      {JSON.stringify(currentSelectedJob.payload, null, 2)}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Pagination Bar */}
      <div className="pagination-bar">
        <div className="pag-info">
          {total > 0
            ? `Showing ${startIdx} - ${endIdx} of ${total} active pool models`
            : "No active pool models"}
        </div>
        <div className="pag-buttons">
          <button
            className="btn-action"
            style={{ padding: "4px 8px" }}
            onClick={handlePrevPage}
            disabled={page === 0}
          >
            <i className="ti ti-chevron-left"></i>
          </button>
          <button
            className="btn-action"
            style={{ padding: "4px 8px" }}
            onClick={handleNextPage}
            disabled={endIdx >= total}
          >
            <i className="ti ti-chevron-right"></i>
          </button>
        </div>
      </div>

      {showAddDrawer && (
        <AddJobDrawer onClose={() => setShowAddDrawer(false)} onAdded={fetchJobs} />
      )}

      <ConfirmDialog
        open={!!deleteConfirm}
        onCancel={() => setDeleteConfirm(null)}
        onConfirm={confirmDelete}
        title="Delete Job"
        message={deleteConfirm ? `Remove "${deleteConfirm.type}" job from the queue? This action cannot be undone.` : ""}
        confirmLabel="Delete Job"
        variant="danger"
        loading={deleting}
      />
    </>
  );
};

export default JobsPage;