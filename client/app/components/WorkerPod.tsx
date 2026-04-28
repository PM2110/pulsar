import React from "react";
import { WorkerInfo } from "../types";
import { timeSince } from "../lib/utils";

export const WorkerPod = ({
  worker,
  onStop,
}: {
  worker: WorkerInfo;
  onStop: (id: string) => void;
}) => {
  return (
    <div className={`worker-pod ${worker.status}`}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <div
              className={`pulse-dot ${worker.status === "processing"
                  ? "pulse-white"
                  : worker.status === "idle"
                    ? "pulse-green"
                    : "pulse-gray"
                }`}
              style={{ width: 7, height: 7 }}
            />
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
              {worker.worker_id}
            </span>
          </div>
          <span
            style={{
              fontSize: 11,
              fontFamily: "monospace",
              color: "var(--text-muted)",
              background: "rgba(255,255,255,0.04)",
              padding: "2px 7px",
              borderRadius: 4,
            }}
          >
            queue:{worker.queue_name}
          </span>
        </div>
        <span
          className={`badge badge-${worker.status === "processing"
              ? "processing"
              : worker.status === "idle"
                ? "completed"
                : "pending"
            }`}
        >
          {worker.status === "processing" && <div className="spinner" style={{ width: 9, height: 9 }} />}
          {worker.status}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
        {[
          { label: "Processed", value: worker.jobs_processed, color: "var(--completed)" },
          { label: "Failed", value: worker.jobs_failed, color: "var(--failed)" },
          { label: "Active", value: worker.status === "processing" ? "Yes" : "No", color: worker.status === "processing" ? "var(--processing)" : "var(--text-muted)" },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              background: "rgba(255,255,255,0.03)",
              borderRadius: 7,
              padding: "8px 10px",
              border: "1px solid var(--border)",
            }}
          >
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 2 }}>{s.label}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {worker.current_job_id && (
        <div
          style={{
            background: "rgba(226,232,240,0.05)",
            border: "1px solid rgba(226,232,240,0.1)",
            borderRadius: 7,
            padding: "8px 10px",
            marginBottom: 12,
            fontSize: 11,
          }}
        >
          <span style={{ color: "var(--text-muted)" }}>Processing: </span>
          <span style={{ fontFamily: "monospace", color: "var(--processing)" }}>
            #{worker.current_job_id}
          </span>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
          Active {timeSince(worker.last_activity)}
        </span>
        {worker.status !== "stopped" && (
          <button
            className="btn btn-danger"
            style={{ padding: "4px 12px", fontSize: 11 }}
            onClick={() => onStop(worker.worker_id)}
          >
            ■ Stop
          </button>
        )}
      </div>
    </div>
  );
};
