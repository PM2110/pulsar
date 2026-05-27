import React, { useState, useEffect } from "react";
import { Job, EnrichedJobAttempt } from "../types";
import { apiService } from "../lib/api.service";
import { StatusBadge } from "./StatusBadge";
import { formatTime } from "../lib/utils";
import { Accordion } from "./ui";

/* ── tiny helpers ───────────────────────────────────────────── */
function KV({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="jm-kv">
      <div className="jm-kv-label">{label}</div>
      <div className={`jm-kv-value${mono ? " mono" : ""}`}>{value ?? "—"}</div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="jm-section-label">{children}</div>;
}

function AttemptStatusIcon({ status }: { status: string }) {
  if (status === "completed") return (
    <span className="jm-attempt-icon jm-attempt-icon--ok">
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
  if (status === "failed") return (
    <span className="jm-attempt-icon jm-attempt-icon--fail">
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </span>
  );
  if (status === "processing") return (
    <span className="jm-attempt-icon jm-attempt-icon--run">
      <span className="spinner" style={{ width: 10, height: 10, borderWidth: 1.5 }} />
    </span>
  );
  return <span className="jm-attempt-icon jm-attempt-icon--pending" />;
}

/* ── retry pills along the top ─────────────────────────────── */
function AttemptTrack({ job }: { job: Job }) {
  return (
    <div className="jm-track">
      {Array.from({ length: job.max_attempts }).map((_, i) => {
        const done = i < job.attempts;
        const current = i === job.attempts - 1;
        let cls = "jm-track-seg";
        if (done && current) {
          if (job.status === "completed") cls += " jm-track-seg--ok";
          else if (job.status === "failed") cls += " jm-track-seg--fail";
          else if (job.status === "processing") cls += " jm-track-seg--run";
        } else if (done) {
          cls += " jm-track-seg--prev";
        }
        return <div key={i} className={cls} title={`Attempt ${i + 1}`} />;
      })}
    </div>
  );
}

/* ── main component ─────────────────────────────────────────── */
export const JobModal = ({
  job, onClose, onRetry,
}: {
  job: Job;
  onClose: () => void;
  onRetry?: (id: string) => void;
}) => {
  const [detailedJob, setDetailedJob] = useState<Job | null>(null);
  const [attempts, setAttempts] = useState<EnrichedJobAttempt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiService.getJobDetails(job.id)
      .then((res) => {
        if (res.job) setDetailedJob(res.job);
        if (res.attempts) setAttempts(res.attempts);
      })
      .catch(() => { })
      .finally(() => setLoading(false));
  }, [job.id]);

  const j = detailedJob || job;

  const statusColor =
    j.status === "completed" ? "var(--green)"
      : j.status === "failed" ? "var(--red)"
        : j.status === "processing" ? "var(--blue)"
          : "var(--text-faint)";

  /* total duration from created to completed/failed */
  const finishedAt = j.completed_at || j.failed_at;
  const totalDuration = finishedAt
    ? (() => {
      const ms = new Date(finishedAt).getTime() - new Date(j.created_at).getTime();
      return ms < 1000 ? `${ms}ms` : ms < 60000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
    })()
    : null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal jm-modal" onClick={(e) => e.stopPropagation()}>

        {/* ── STATUS STRIPE ── */}
        <div className="jm-status-stripe" style={{ background: statusColor }} />

        {/* ── HEADER ── */}
        <div className="jm-header">
          <div className="jm-header-left">
            <div className="jm-header-meta">
              <span className="jm-id mono">#{j.id.slice(0, 12)}</span>
              <StatusBadge status={j.status} />
              {j.status === "failed" && onRetry && (
                <button
                  className="btn btn-ghost jm-retry-btn"
                  onClick={() => onRetry(j.id)}
                >
                  ↻ Retry
                </button>
              )}
            </div>
            <h2 className="jm-title">{j.job_type}</h2>
            <div className="jm-subtitle">
              <span className="chip" style={{ fontSize: 10 }}>{j.queue_name}</span>
              <span className="jm-dot" />
              <span>Priority {j.priority}</span>
              <span className="jm-dot" />
              <span className="mono" style={{ fontSize: 11 }}>{j.failure_mode}</span>
              {j.fail_probability != null && (
                <span style={{ color: "var(--text-faint)", fontSize: 11 }}>
                  ({Math.round(j.fail_probability * 100)}%)
                </span>
              )}
            </div>
          </div>
          <button className="btn btn-ghost jm-close-btn" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* ── ATTEMPT TRACK ── */}
        <div className="jm-track-wrap">
          <div className="jm-track-row">
            <span className="jm-track-label">
              Attempt {j.attempts} / {j.max_attempts}
            </span>
            <AttemptTrack job={j} />
          </div>
        </div>

        {/* ── SCROLLABLE BODY ── */}
        <div className="jm-body">

          {/* ── STATS STRIP ── */}
          <div className="jm-stats-strip">
            {[
              { label: "Created", value: formatTime(j.created_at) },
              { label: "Completed", value: formatTime(j.completed_at) },
              { label: "Failed At", value: formatTime(j.failed_at) },
              { label: "Duration", value: totalDuration ?? "—" },
            ].map(s => (
              <div key={s.label} className="jm-stat">
                <div className="jm-stat-label">{s.label}</div>
                <div className="jm-stat-value">{s.value}</div>
              </div>
            ))}
          </div>

          {/* ── LAST ERROR ── */}
          {j.last_error && (
            <div className="jm-error-banner">
              <div className="jm-error-banner-title">
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" strokeWidth="1.3" />
                  <path d="M6.5 4v3M6.5 9v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
                Last Error
              </div>
              <div className="jm-error-banner-body">{j.last_error}</div>
            </div>
          )}

          {/* ── PAYLOAD ── */}
          <div className="jm-section">
            <Accordion
              title="Job Payload"
              icon={
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <rect x="1.5" y="1.5" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.3" />
                  <path d="M4 5h6M4 7h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
              }
              desc="Input data passed to the job handler"
            >
              <pre className="jm-payload-pre">
                {JSON.stringify(
                  typeof j.payload === "string" ? JSON.parse(j.payload) : j.payload,
                  null, 2
                )}
              </pre>
            </Accordion>
          </div>

          {/* ── EXECUTION HISTORY ── */}
          <div className="jm-section">
            <SectionLabel>
              Execution History
              {!loading && attempts.length > 0 && (
                <span className="acc-badge" style={{ marginLeft: 8 }}>{attempts.length}</span>
              )}
            </SectionLabel>

            {loading ? (
              <div className="jm-loading">
                <span className="spinner" />
                Loading attempts…
              </div>
            ) : attempts.length === 0 ? (
              <div className="jm-empty">No execution attempts recorded yet.</div>
            ) : (
              <div className="jm-attempts">
                {attempts.map((att, idx) => {
                  const durationMs = att.finished_at
                    ? new Date(att.finished_at).getTime() - new Date(att.started_at).getTime()
                    : null;
                  const dur = durationMs != null
                    ? durationMs < 1000 ? `${durationMs}ms` : `${(durationMs / 1000).toFixed(2)}s`
                    : null;

                  return (
                    <Accordion
                      key={att.id}
                      defaultOpen={idx === 0}
                      title=""
                      icon={<AttemptStatusIcon status={att.status} />}
                      badge={
                        <div className="jm-acc-title">
                          <span className="jm-acc-attempt">Attempt #{att.attempt_number}</span>
                          <StatusBadge status={att.status} />
                          {dur && <span className="jm-acc-dur">{dur}</span>}
                        </div>
                      }
                      rightContent={
                        <span className="jm-acc-time">{formatTime(att.started_at)}</span>
                      }
                    >
                      {/* Worker + Timing grid */}
                      <div className="jm-detail-grid">
                        <div className="jm-detail-group">
                          <div className="jm-detail-group-label">Worker</div>
                          <KV label="ID" value={att.worker_id} mono />
                          <KV label="Hostname" value={att.worker_hostname} mono />
                          <KV label="PID" value={att.worker_pid} />
                        </div>
                        <div className="jm-detail-group">
                          <div className="jm-detail-group-label">Timing</div>
                          <KV label="Started" value={formatTime(att.started_at)} />
                          <KV label="Finished" value={att.finished_at ? formatTime(att.finished_at) : "Running…"} />
                          <KV label="Queue Latency" value={att.queue_latency_ms != null ? `${att.queue_latency_ms}ms` : null} />
                          <KV label="Execution" value={dur} />
                        </div>
                      </div>

                      {/* Error */}
                      {att.error && (
                        <div className="jm-att-error">
                          <div className="jm-att-error-title">Error</div>
                          <div className="jm-att-error-msg">{att.error}</div>
                          {att.stack_trace && (
                            <details className="jm-stack-details">
                              <summary>Show stack trace</summary>
                              <pre className="jm-stack-pre">{att.stack_trace}</pre>
                            </details>
                          )}
                        </div>
                      )}
                    </Accordion>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
