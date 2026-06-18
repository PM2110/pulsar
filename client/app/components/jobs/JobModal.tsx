"use client";

import React, { useState, useEffect } from "react";
import { Job, EnrichedJobAttempt } from "../../types";
import { apiService } from "../../lib/api.service";
import { StatusBadge, Accordion, Modal, ModalHeader, ModalBody, Button, Spinner, Chip } from "../ui";
import { formatTime } from "../../lib/utils";
import { CheckIcon, CloseIcon, AlertCircleIcon, RetryIcon } from "../icons";

function KV({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="pls-jm-kv">
      <div className="pls-jm-kv-label">{label}</div>
      <div className={`pls-jm-kv-value${mono ? " mono" : ""}`}>{value ?? "—"}</div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="pls-jm-section-label">{children}</div>;
}

function AttemptStatusIcon({ status }: { status: string }) {
  if (status === "completed") return (
    <span className="pls-jm-attempt-icon pls-jm-attempt-icon--ok">
      <CheckIcon size={10} />
    </span>
  );
  if (status === "failed") return (
    <span className="pls-jm-attempt-icon pls-jm-attempt-icon--fail">
      <CloseIcon size={10} />
    </span>
  );
  if (status === "processing") return (
    <span className="pls-jm-attempt-icon pls-jm-attempt-icon--run">
      <Spinner size={10} />
    </span>
  );
  return <span className="pls-jm-attempt-icon pls-jm-attempt-icon--pending" />;
}

function AttemptTrack({ job }: { job: Job }) {
  return (
    <div className="pls-jm-track">
      {Array.from({ length: job.max_attempts }).map((_, i) => {
        const done = i < job.attempts;
        const current = i === job.attempts - 1;
        let cls = "pls-jm-track-seg";
        if (done && current) {
          if (job.status === "completed") cls += " pls-jm-track-seg--ok";
          else if (job.status === "failed") cls += " pls-jm-track-seg--fail";
          else if (job.status === "processing") cls += " pls-jm-track-seg--run";
        } else if (done) {
          cls += " pls-jm-track-seg--prev";
        }
        return <div key={i} className={cls} title={`Attempt ${i + 1}`} />;
      })}
    </div>
  );
}

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
    j.status === "completed" ? "var(--success)"
      : j.status === "failed" ? "var(--danger)"
        : j.status === "processing" ? "var(--primary)"
          : "var(--text-faint)";

  const finishedAt = j.completed_at || j.failed_at;
  const totalDuration = finishedAt
    ? (() => {
      const ms = new Date(finishedAt).getTime() - new Date(j.created_at).getTime();
      return ms < 1000 ? `${ms}ms` : ms < 60000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
    })()
    : null;

  return (
    <Modal open={true} onClose={onClose} className="pls-jm-modal">
      <div className="pls-jm-stripe" style={{ background: statusColor }} />
      <ModalHeader onClose={onClose}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <span className="pls-jm-id mono">#{j.id.slice(0, 12)}</span>
          <StatusBadge status={j.status} />
          {j.status === "failed" && onRetry && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRetry(j.id)}
              icon={<RetryIcon size={11} />}
            >
              Retry
            </Button>
          )}
        </div>
        <h2 className="pls-jm-title">{j.job_type}</h2>
        <div className="pls-jm-subtitle">
          <Chip>{j.queue_name}</Chip>
          <span className="pls-jm-dot" />
          <span>Priority {j.priority}</span>
          <span className="pls-jm-dot" />
          <span className="mono" style={{ fontSize: 11 }}>{j.failure_mode}</span>
          {j.fail_probability != null && (
            <span style={{ color: "var(--text-faint)", fontSize: 11 }}>
              ({Math.round(j.fail_probability * 100)}%)
            </span>
          )}
        </div>
      </ModalHeader>

      <div className="pls-jm-track-wrap">
        <div className="pls-jm-track-row">
          <span className="pls-jm-track-label">
            Attempt {j.attempts} / {j.max_attempts}
          </span>
          <AttemptTrack job={j} />
        </div>
      </div>

      <ModalBody>
        {/* STATS STRIP */}
        <div className="pls-jm-stats-strip">
          {[
            { label: "Created", value: formatTime(j.created_at) },
            { label: "Completed", value: formatTime(j.completed_at) },
            { label: "Failed At", value: formatTime(j.failed_at) },
            { label: "Duration", value: totalDuration ?? "—" },
          ].map(s => (
            <div key={s.label} className="pls-jm-stat">
              <div className="pls-jm-stat-label">{s.label}</div>
              <div className="pls-jm-stat-value">{s.value}</div>
            </div>
          ))}
        </div>

        {/* LAST ERROR */}
        {j.last_error && (
          <div className="pls-jm-error-banner">
            <div className="pls-jm-error-title">
              <AlertCircleIcon size={13} />
              Last Error
            </div>
            <div className="pls-jm-error-body">{j.last_error}</div>
          </div>
        )}

        {/* PAYLOAD */}
        <div className="pls-jm-section">
          <Accordion
            title="Job Payload"
            icon="📦"
            desc="Input data passed to the job handler"
          >
            <pre className="pls-jm-payload-pre">
              {JSON.stringify(
                typeof j.payload === "string" ? JSON.parse(j.payload) : j.payload,
                null, 2
              )}
            </pre>
          </Accordion>
        </div>

        {/* EXECUTION HISTORY */}
        <div className="pls-jm-section">
          <SectionLabel>
            Execution History
            {!loading && attempts.length > 0 && (
              <span className="pls-acc-badge" style={{ marginLeft: 8 }}>{attempts.length}</span>
            )}
          </SectionLabel>

          {loading ? (
            <div className="pls-jm-loading">
              <Spinner />
              Loading attempts…
            </div>
          ) : attempts.length === 0 ? (
            <div className="pls-jm-empty">No execution attempts recorded yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontWeight: 600 }}>
                          Attempt #{att.business_attempt}
                          {att.infra_attempt > 0 && (
                            <span style={{ opacity: 0.7, fontSize: '0.9em', marginLeft: '6px' }}>
                              (Infra #{att.infra_attempt})
                            </span>
                          )}
                        </span>
                        <StatusBadge status={att.status} />
                        {dur && <span style={{ color: "var(--text-faint)", fontSize: 11, fontVariantNumeric: "tabular-nums" }}>{dur}</span>}
                      </div>
                    }
                    rightContent={
                      <span style={{ fontSize: 11, color: "var(--text-dim)" }}>{formatTime(att.started_at)}</span>
                    }
                  >
                    {/* Worker + Timing grid */}
                    <div className="pls-jm-detail-grid">
                      <div>
                        <div className="pls-jm-detail-group-label">Worker</div>
                        <KV label="ID" value={att.worker_id} mono />
                        <KV label="Hostname" value={att.worker_hostname} mono />
                        <KV label="PID" value={att.worker_pid} />
                      </div>
                      <div>
                        <div className="pls-jm-detail-group-label">Timing</div>
                        <KV label="Started" value={formatTime(att.started_at)} />
                        <KV label="Finished" value={att.finished_at ? formatTime(att.finished_at) : "Running…"} />
                        <KV label="Queue Latency" value={att.queue_latency_ms != null ? `${att.queue_latency_ms}ms` : null} />
                        <KV label="Execution" value={dur} />
                      </div>
                    </div>

                    {/* Error */}
                    {att.error && (
                      <div className="pls-jm-att-error">
                        <div className="pls-jm-att-error-title">Error</div>
                        <div className="pls-jm-att-error-msg">{att.error}</div>
                        {att.stack_trace && (
                          <details className="pls-jm-stack-details">
                            <summary style={{ fontSize: 11, cursor: "pointer", color: "var(--text-dim)" }}>Show stack trace</summary>
                            <pre className="pls-jm-stack-pre">{att.stack_trace}</pre>
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
      </ModalBody>
    </Modal>
  );
};
