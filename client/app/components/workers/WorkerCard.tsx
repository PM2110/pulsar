"use client";

import React, { useState } from "react";
import { WorkerInfo } from "../../types";
import { Tooltip, Checkbox, Button } from "../ui";
import { ShieldIcon, BarChartIcon, CrashIcon, StopIcon, PlayIcon, TrashIcon } from "../icons";
import { apiService } from "../../lib/api.service";

interface WorkerCardProps {
  w: WorkerInfo;
  now: number;
  onRefresh: () => void;
  onCrash: (id: string) => Promise<any>;
  onStop: (id: string, options?: any) => Promise<any>;
}

const ST: Record<string, { badge: string; dot: string; label: string }> = {
  idle: { badge: "pls-badge--completed", dot: "pls-dot--success", label: "IDLE" },
  processing: { badge: "pls-badge--processing", dot: "pls-dot--primary", label: "PROCESSING" },
  stopped: { badge: "pls-badge--pending", dot: "pls-dot--muted", label: "STOPPED" },
};

function ago(iso: string, now: number) {
  const d = now - new Date(iso).getTime();
  if (d < 5000) return "just now";
  return d < 60000 ? `${Math.floor(d / 1000)}s ago` : `${Math.floor(d / 60000)}m ago`;
}

export function WorkerCard({ w, now, onRefresh, onCrash, onStop }: WorkerCardProps) {
  const [menu, setMenu] = useState(false);
  const [crashing, setCrashing] = useState(false);

  const stale = w.status !== "stopped" && (now - new Date(w.last_activity).getTime() > 30000);
  const cfg = ST[w.status] || ST.stopped;
  const totalJobs = w.jobs_processed + w.jobs_failed;
  const rate = totalJobs > 0 ? Math.round((w.jobs_processed / totalJobs) * 100) : 100;

  const indicatorColor = stale
    ? "var(--danger)"
    : w.status === "processing"
      ? "var(--primary)"
      : w.status === "idle"
        ? "var(--success)"
        : "var(--text-faint)";

  const handleStopClick = async (options?: any) => {
    setMenu(false);
    await onStop(w.worker_id, options);
    onRefresh();
  };

  const handleStart = async () => {
    try {
      await apiService.startWorker({ worker_id: w.worker_id, queue_name: w.queue_name });
      onRefresh();
    } catch { }
  };

  const handleRemove = async () => {
    if (confirm(`Remove worker '${w.worker_id}' from registry?`)) {
      try {
        await apiService.deleteWorker(w.worker_id);
        onRefresh();
      } catch { }
    }
  };

  const handleCrash = async () => {
    setCrashing(true);
    try {
      await onCrash(w.worker_id);
      onRefresh();
    } finally {
      setCrashing(false);
    }
  };

  return (
    <div className="pls-worker-card">
      <div className="pls-worker-card-indicator" style={{ background: indicatorColor }} />

      {stale && (
        <div style={{
          background: "var(--danger-soft)", color: "var(--danger)", fontSize: 10,
          textAlign: "center", padding: "5px 0", fontWeight: 700,
          borderRadius: "0 var(--radius) 0 0", position: "absolute",
          top: 0, left: 4, right: 0, letterSpacing: ".06em"
        }}>
          DISCONNECTED
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, marginTop: stale ? 18 : 0, paddingLeft: 10 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div className={`pls-dot ${cfg.dot}`} />
            <span style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-.02em" }}>{w.worker_id}</span>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <span className="pls-chip" style={{ fontFamily: "monospace" }}>queue:{w.queue_name}</span>
            {w.auto_restart && (
              <Tooltip text="Automatically restarts on crash">
                <span style={{ fontSize: 10, color: "var(--success)", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 3 }}>
                  <ShieldIcon size={10} /> AUTO-HEAL
                </span>
              </Tooltip>
            )}
            {w.adaptive_scaling !== false && (
              <Tooltip text="Adaptive scaling enabled">
                <span style={{ fontSize: 10, color: "var(--primary)", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 3 }}>
                  <BarChartIcon size={10} /> AUTO-SCALE
                </span>
              </Tooltip>
            )}
          </div>
        </div>
        <span className={`pls-badge ${stale ? "pls-badge--failed" : cfg.badge}`} style={{ fontSize: "10.5px" }}>
          {stale ? "OFFLINE" : cfg.label}
        </span>
      </div>

      {/* Stats Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 18, paddingLeft: 10 }}>
        {[
          { l: "Processed", v: String(w.jobs_processed), c: "var(--success)", tip: "Total successfully processed" },
          { l: "Failed", v: String(w.jobs_failed), c: "var(--danger)", tip: "Total failed attempts" },
          { l: "Slots", v: `${w.active_job_ids.length}/${w.concurrency}`, c: "var(--primary)", tip: "Active / total concurrency slots" },
          { l: "Success", v: `${rate}%`, c: rate >= 80 ? "var(--success)" : "var(--danger)", tip: "Overall success rate" },
        ].map((s) => (
          <Tooltip key={s.l} text={s.tip}>
            <div className="pls-queue-mini" style={{ width: "100%" }}>
              <div className="pls-queue-mini-label">{s.l}</div>
              <div className="pls-queue-mini-val" style={{ color: s.c, fontSize: 16 }}>{s.v}</div>
            </div>
          </Tooltip>
        ))}
      </div>

      {/* Utilization Bar */}
      <div style={{ marginBottom: 16, paddingLeft: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-faint)", marginBottom: 5, fontWeight: 600 }}>
          <span>UTILIZATION</span><span>{w.active_job_ids.length}/{w.concurrency} SLOTS</span>
        </div>
        <div className="pls-capacity-bar">
          {Array.from({ length: w.concurrency }).map((_, i) => (
            <div key={i} className="pls-capacity-seg" style={{ flex: 1, background: i < w.active_job_ids.length ? "var(--primary)" : "var(--border)" }} />
          ))}
        </div>
      </div>

      {/* Settings Toggles */}
      <div style={{ display: "flex", gap: 16, paddingLeft: 10, marginBottom: 16 }}>
        <Checkbox
          checked={w.auto_restart}
          onChange={async (checked) => {
            try {
              await apiService.updateWorkerSettings(w.worker_id, { auto_restart: checked });
              onRefresh();
            } catch { }
          }}
          label="🛡️ Auto-Heal"
        />
        <Checkbox
          checked={w.adaptive_scaling !== false}
          onChange={async (checked) => {
            try {
              await apiService.updateWorkerSettings(w.worker_id, { adaptive_scaling: checked });
              onRefresh();
            } catch { }
          }}
          label="📊 Auto-Scale"
        />
      </div>

      {/* Active Jobs list */}
      {w.active_job_ids.length > 0 && (
        <div style={{ marginBottom: 16, paddingLeft: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>Active Jobs</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {w.active_job_ids.map(id => (
              <span key={id} className="pls-chip" style={{ fontFamily: "monospace", fontSize: 10 }}>{id.substring(0, 8)}</span>
            ))}
          </div>
        </div>
      )}

      {/* Footer controls */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 16, borderTop: "1px solid var(--border)", paddingLeft: 10 }}>
        <Tooltip text={`Started: ${new Date(w.started_at).toLocaleString()}`}>
          <span style={{ fontSize: 11, color: "var(--text-faint)" }}>Active {ago(w.last_activity, now)}</span>
        </Tooltip>

        <div style={{ display: "flex", gap: 6 }}>
          {w.status !== "stopped" && !stale ? (
            <>
              <Tooltip text="Simulate crash for testing">
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleCrash}
                  disabled={crashing}
                  icon={<CrashIcon size={11} />}
                >
                  {crashing ? "..." : "Crash"}
                </Button>
              </Tooltip>
              <div style={{ position: "relative" }}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMenu(!menu)}
                  icon={<StopIcon size={11} />}
                >
                  Stop
                </Button>
                {menu && (
                  <div style={{
                    position: "absolute", bottom: "100%", right: 0, width: 170, zIndex: 100,
                    marginBottom: 6, background: "var(--bg-card)", border: "1px solid var(--border-strong)",
                    borderRadius: 8, padding: 4, boxShadow: "var(--shadow-lg)"
                  }}>
                    {[
                      { l: "Manual Stop", fn: () => handleStopClick() },
                      { l: "Auto-Restart", fn: () => handleStopClick({ auto_restart: true }) },
                      { l: "Restart in 30s", fn: () => handleStopClick({ restart_in: 30 }) }
                    ].map(m => (
                      <button
                        key={m.l}
                        onClick={m.fn}
                        style={{
                          display: "block", width: "100%", textAlign: "left", background: "none",
                          border: "none", padding: "8px 12px", fontSize: 12, color: "var(--text-secondary)",
                          cursor: "pointer", borderRadius: 4, fontFamily: "inherit"
                        }}
                      >
                        {m.l}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div style={{ display: "flex", gap: 6 }}>
              <Button
                variant="success"
                size="sm"
                onClick={handleStart}
                icon={<PlayIcon size={11} />}
              >
                Start
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleRemove}
                icon={<TrashIcon size={11} />}
              >
                Remove
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
