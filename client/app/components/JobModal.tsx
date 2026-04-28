import React, { useState, useEffect } from "react";
import { Job, JobAttempt } from "../types";
import { apiService } from "../lib/api.service";
import { StatusBadge } from "./StatusBadge";
import { formatTime } from "../lib/utils";

export const JobModal = ({ job, onClose, onRetry }: { job: Job; onClose: () => void; onRetry?: (id: string) => void }) => {
  useEffect(() => {
    // Optionally fetch more detailed attempts here
    apiService.getJobDetails(job.id).catch(() => {});
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
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {job.status === "failed" && onRetry && (
              <button className="btn btn-ghost" onClick={() => onRetry(job.id)} style={{ padding: "4px 10px", fontSize: 12, border: "1px solid rgba(255,255,255,0.1)" }}>
                ↻ Retry
              </button>
            )}
            <button className="btn btn-ghost" onClick={onClose} style={{ padding: "4px 10px" }}>
              ✕
            </button>
          </div>
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
                if (done && job.status === "completed" && current) bg = "#22c55e";
                else if (done && job.status === "failed" && current) bg = "var(--failed)";
                else if (done && current && job.status === "processing") bg = "rgba(255,255,255,0.5)";
                else if (done) bg = "rgba(239,68,68,0.4)";
                return (
                  <div
                    key={i}
                    style={{
                      flex: 1, height: 6, borderRadius: 3, background: bg, transition: "background 0.3s",
                    }}
                    title={`Attempt ${i + 1}`}
                  />
                );
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>
              <span>1</span><span>{job.max_attempts}</span>
            </div>
          </div>

          {/* Error */}
          {job.last_error && (
            <div
              style={{
                background: "var(--failed-bg)", border: "1px solid rgba(252,165,165,0.2)",
                borderRadius: 8, padding: "12px 14px", marginBottom: 20,
              }}
            >
              <div style={{ fontSize: 11, color: "var(--failed)", fontWeight: 600, marginBottom: 4 }}>Last Error</div>
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
                background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)",
                borderRadius: 8, padding: 14, fontSize: 12, color: "var(--text-secondary)",
                fontFamily: "monospace", overflow: "auto", maxHeight: 200,
              }}
            >
              {JSON.stringify(typeof job.payload === "string" ? JSON.parse(job.payload) : job.payload, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
