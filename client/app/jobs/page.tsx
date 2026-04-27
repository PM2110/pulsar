"use client";

import { useEffect, useState, useCallback } from "react";
import { apiService, socket } from "../lib/api.service";

interface Job {
  id: string;
  queue_name: string;
  job_type: string;
  payload: any;
  status: string;
  priority: number;
  attempts: number;
  max_attempts: number;
  failure_mode: string;
  fail_probability: number | null;
  last_error: string | null;
  run_at: string;
  created_at: string;
  completed_at: string | null;
  failed_at: string | null;
}

interface JobAttempt {
  id: string;
  attempt_number: number;
  status: string;
  worker_id: string;
  started_at: string;
  finished_at: string | null;
  execution_time_ms: number | null;
  queue_latency_ms: number | null;
  error: string | null;
}

const STATUS_CLASS: Record<string, string> = {
  pending: "badge-pending",
  processing: "badge-processing",
  completed: "badge-completed",
  failed: "badge-failed",
};

const QUEUES = ["notifications", "media", "default"];
const JOB_TYPES: Record<string, string[]> = {
  notifications: ["email_send", "sms_send", "push_notify"],
  media: ["image_resize", "video_transcode", "thumbnail_gen", "video_extract_audio", "image_watermark"],
  default: ["data_export", "report_generate", "cache_warmup", "cleanup_task"],
};

function formatTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`badge ${STATUS_CLASS[status] || "badge-pending"}`}>
      {status === "processing" && <div className="spinner" style={{ width: 9, height: 9, marginRight: 2 }} />}
      {status}
    </span>
  );
}

function JobModal({ job, onClose }: { job: Job; onClose: () => void }) {
  const [attempts, setAttempts] = useState<JobAttempt[]>([]);

  useEffect(() => {
    apiService.getJobDetails(job.id)
      .then(() => {})
      .catch(() => {});
    // Fetch attempts (we'll get them from a separate endpoint — for now show job details)
  }, [job.id]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div
          style={{
            padding: "22px 24px 16px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <span style={{ fontFamily: "monospace", fontSize: 13, color: "var(--text-muted)" }}>
                #{job.id}
              </span>
              <StatusBadge status={job.status} />
            </div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>
              {job.job_type}
            </h2>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
              {job.queue_name} · priority {job.priority} · {job.failure_mode}
            </p>
          </div>
          <button className="btn btn-ghost" onClick={onClose} style={{ padding: "4px 10px" }}>
            ✕
          </button>
        </div>

        <div style={{ padding: 24 }}>
          {/* Timeline */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", gap: 0 }}>
              {[
                { label: "Attempts", value: `${job.attempts}/${job.max_attempts}` },
                { label: "Created", value: formatTime(job.created_at) },
                { label: "Completed", value: formatTime(job.completed_at) },
                { label: "Failed at", value: formatTime(job.failed_at) },
              ].map((item) => (
                <div key={item.label} style={{ flex: 1, paddingRight: 12 }}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 3 }}>{item.label}</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 500 }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Attempt progress bars */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>Attempt history</div>
            <div style={{ display: "flex", gap: 6 }}>
              {Array.from({ length: job.max_attempts }).map((_, i) => {
                const done = i < job.attempts;
                const current = i === job.attempts - 1;
                let bg = "rgba(255,255,255,0.06)";
                if (done && job.status === "completed" && current) bg = "var(--completed)";
                else if (done && job.status === "failed" && current) bg = "var(--failed)";
                else if (done && current && job.status === "processing") bg = "var(--processing)";
                else if (done) bg = "var(--retrying)";
                return (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      height: 6,
                      borderRadius: 3,
                      background: bg,
                      transition: "background 0.3s",
                    }}
                    title={`Attempt ${i + 1}`}
                  />
                );
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>
              <span>1</span>
              <span>{job.max_attempts}</span>
            </div>
          </div>

          {/* Error */}
          {job.last_error && (
            <div
              style={{
                background: "var(--failed-bg)",
                border: "1px solid rgba(252,165,165,0.2)",
                borderRadius: 8,
                padding: "12px 14px",
                marginBottom: 20,
              }}
            >
              <div style={{ fontSize: 11, color: "var(--failed)", fontWeight: 600, marginBottom: 4 }}>
                Last Error
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "monospace", wordBreak: "break-all" }}>
                {job.last_error}
              </div>
            </div>
          )}

          {/* Payload */}
          <div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>Payload</div>
            <pre
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: 14,
                fontSize: 12,
                color: "var(--text-secondary)",
                fontFamily: "monospace",
                overflow: "auto",
                maxHeight: 200,
              }}
            >
              {JSON.stringify(
                typeof job.payload === "string" ? JSON.parse(job.payload) : job.payload,
                null,
                2
              )}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddJobDrawer({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [form, setForm] = useState({
    queue_name: "notifications",
    job_type: "email_send",
    payload: '{\n  "to": "user@example.com",\n  "subject": "Hello"\n}',
    priority: 5,
    max_attempts: 3,
    failure_mode: "probably_fail",
    fail_probability: 0.3,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const availableTypes = JOB_TYPES[form.queue_name] || JOB_TYPES.default;

  const handleQueueChange = (q: string) => {
    const types = JOB_TYPES[q] || JOB_TYPES.default;
    setForm((f) => ({ ...f, queue_name: q, job_type: types[0] }));
  };

  const handleSubmit = async () => {
    setSaving(true);
    setErr(null);
    try {
      let payload;
      try {
        payload = JSON.parse(form.payload);
      } catch {
        setErr("Invalid JSON payload");
        setSaving(false);
        return;
      }
      await apiService.createJob({ ...form, payload });
      onAdded();
      onClose();
    } catch (e: any) {
      setErr(e.message || "Failed to create job");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer">
        <div
          style={{
            padding: "20px 24px 16px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>Add Job</h2>
          <button className="btn btn-ghost" onClick={onClose} style={{ padding: "4px 10px" }}>✕</button>
        </div>
        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label className="label">Queue</label>
            <select className="select" value={form.queue_name} onChange={(e) => handleQueueChange(e.target.value)}>
              {QUEUES.map((q) => <option key={q} value={q}>{q}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Job Type</label>
            <select className="select" value={form.job_type} onChange={(e) => setForm((f) => ({ ...f, job_type: e.target.value }))}>
              {availableTypes.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Payload (JSON)</label>
            <textarea
              className="textarea"
              value={form.payload}
              onChange={(e) => setForm((f) => ({ ...f, payload: e.target.value }))}
              style={{ fontFamily: "monospace", fontSize: 12 }}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label className="label">Priority: {form.priority}</label>
              <input
                type="range" min={0} max={10} value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: Number(e.target.value) }))}
                style={{ width: "100%" }}
              />
            </div>
            <div>
              <label className="label">Max attempts</label>
              <input
                type="number" className="input" min={1} max={10} value={form.max_attempts}
                onChange={(e) => setForm((f) => ({ ...f, max_attempts: Number(e.target.value) }))}
              />
            </div>
          </div>
          <div>
            <label className="label">Failure mode</label>
            <select className="select" value={form.failure_mode} onChange={(e) => setForm((f) => ({ ...f, failure_mode: e.target.value }))}>
              <option value="succeed">Always succeed</option>
              <option value="fail">Always fail</option>
              <option value="probably_fail">Probabilistic</option>
            </select>
          </div>
          {form.failure_mode === "probably_fail" && (
            <div>
              <label className="label">Fail probability: {(form.fail_probability * 100).toFixed(0)}%</label>
              <input
                type="range" min={0} max={1} step={0.05} value={form.fail_probability}
                onChange={(e) => setForm((f) => ({ ...f, fail_probability: Number(e.target.value) }))}
                style={{ width: "100%" }}
              />
            </div>
          )}
          {err && <p style={{ fontSize: 12, color: "var(--failed)" }}>{err}</p>}
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving} style={{ marginTop: 4 }}>
            {saving ? "Creating..." : "⚡ Create Job"}
          </button>
        </div>
      </div>
    </>
  );
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [queueFilter, setQueueFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showAddDrawer, setShowAddDrawer] = useState(false);
  const LIMIT = 20;

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiService.getJobs({
        limit: LIMIT,
        offset: page * LIMIT,
        status: statusFilter || undefined,
        queue_name: queueFilter || undefined,
      });
      setJobs(data.jobs || []);
      setTotal(data.meta?.count || 0);
    } catch {}
    setLoading(false);
  }, [page, statusFilter, queueFilter]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    const handleJobUpdate = () => {
      clearTimeout(timeout);
      timeout = setTimeout(fetchJobs, 200); // Debounce updates
    };
    
    socket.on("job_update", handleJobUpdate);
    return () => {
      clearTimeout(timeout);
      socket.off("job_update", handleJobUpdate);
    };
  }, [fetchJobs]);

  const deleteJob = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this job?")) return;
    await apiService.deleteJob(id);
    fetchJobs();
  };

  return (
    <div style={{ padding: "28px 32px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
            Jobs
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            {total} jobs · live refreshing via WebSocket
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddDrawer(true)}>
          + Add Job
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <select
          className="select"
          style={{ width: 150 }}
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </select>
        <select
          className="select"
          style={{ width: 160 }}
          value={queueFilter}
          onChange={(e) => { setQueueFilter(e.target.value); setPage(0); }}
        >
          <option value="">All queues</option>
          {QUEUES.map((q) => <option key={q} value={q}>{q}</option>)}
        </select>
        <button className="btn btn-ghost" onClick={() => { setStatusFilter(""); setQueueFilter(""); setPage(0); }}>
          Clear
        </button>
        <div style={{ flex: 1 }} />
        <button className="btn btn-ghost" onClick={fetchJobs}>
          ↻ Refresh
        </button>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {loading && jobs.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
            Loading…
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Type</th>
                <th>Queue</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Attempts</th>
                <th>Mode</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: "center", padding: 32, color: "var(--text-muted)" }}>
                    No jobs found
                  </td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr key={job.id} onClick={() => setSelectedJob(job)}>
                    <td>
                      <span className="mono" style={{ color: "var(--text-muted)" }}>
                        #{job.id.slice(0, 8)}
                      </span>
                    </td>
                    <td style={{ color: "var(--text-primary)", fontWeight: 500 }}>{job.job_type}</td>
                    <td>
                      <span className="mono" style={{ fontSize: 11 }}>{job.queue_name}</span>
                    </td>
                    <td><StatusBadge status={job.status} /></td>
                    <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>{job.priority}</td>
                    <td>
                      <div style={{ display: "flex", gap: 3 }}>
                        {Array.from({ length: job.max_attempts }).map((_, i) => {
                          const attempted = i < job.attempts;
                          const current = i === job.attempts - 1;
                          let bg = "rgba(255,255,255,0.08)";
                          if (attempted && current) {
                            if (job.status === "completed") bg = "var(--completed)";
                            else if (job.status === "failed") bg = "var(--failed)";
                            else if (job.status === "processing") bg = "var(--processing)";
                            else bg = "var(--retrying)";
                          } else if (attempted) bg = "var(--retrying)";
                          return (
                            <div
                              key={i}
                              style={{
                                width: 6, height: 6, borderRadius: 2,
                                background: bg, flexShrink: 0,
                              }}
                            />
                          );
                        })}
                        <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: 4 }}>
                          {job.attempts}/{job.max_attempts}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                        {job.failure_mode}
                        {job.fail_probability != null && ` (${Math.round(job.fail_probability * 100)}%)`}
                      </span>
                    </td>
                    <td style={{ fontSize: 11 }}>{formatTime(job.created_at)}</td>
                    <td>
                      <button
                        className="btn btn-ghost"
                        style={{ padding: "3px 9px", fontSize: 11 }}
                        onClick={(e) => deleteJob(job.id, e)}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14 }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          Showing {page * LIMIT + 1}–{Math.min((page + 1) * LIMIT, total)} of {total}
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost" onClick={() => setPage((p) => p - 1)} disabled={page === 0}>
            ← Prev
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => setPage((p) => p + 1)}
            disabled={(page + 1) * LIMIT >= total}
          >
            Next →
          </button>
        </div>
      </div>

      {selectedJob && <JobModal job={selectedJob} onClose={() => setSelectedJob(null)} />}
      {showAddDrawer && (
        <AddJobDrawer onClose={() => setShowAddDrawer(false)} onAdded={fetchJobs} />
      )}
    </div>
  );
}
