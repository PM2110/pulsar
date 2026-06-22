"use client";

import React, { useState } from "react";
import { WorkerInfo } from "../../types";
import { apiService } from "../../lib/api.service";
import { Tooltip } from "../ui/Tooltip";
import { ConfirmDialog } from "../ui/ConfirmDialog";

interface WorkerCardProps {
  w: WorkerInfo;
  now: number;
  onRefresh: () => void;
  onCrash: (id: string) => Promise<any>;
  onStop: (id: string, options?: any) => Promise<any>;
}

function ago(iso: string, now: number) {
  const d = now - new Date(iso).getTime();
  if (d < 5000) return "just now";
  return d < 60000 ? `${Math.floor(d / 1000)}s ago` : `${Math.floor(d / 60000)}m ago`;
}

export function WorkerCard({ w, now, onRefresh, onCrash, onStop }: WorkerCardProps) {
  const [menu, setMenu] = useState(false);
  const [crashing, setCrashing] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState(false);
  const [removing, setRemoving] = useState(false);

  const stale = w.status !== "stopped" && (now - new Date(w.last_activity).getTime() > 30000);
  const dotColor = stale ? "var(--red)" : w.status === "processing" ? "var(--blue)" : w.status === "idle" ? "var(--green)" : "var(--t2)";
  const badgeCls = stale ? "s-offline" : (w.status === "processing" ? "s-processing" : w.status === "idle" ? "s-idle" : "s-stopped");
  const badgeLbl = stale ? "OFFLINE" : w.status.toUpperCase();
  const totalJobs = w.jobs_processed + w.jobs_failed;
  const rate = totalJobs > 0 ? Math.round((w.jobs_processed / totalJobs) * 100) : 100;
  const slotsUsed = w.active_job_ids.length;

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

  const confirmRemove = async () => {
    setRemoving(true);
    try {
      await apiService.deleteWorker(w.worker_id);
      onRefresh();
    } catch { } finally {
      setRemoving(false);
      setRemoveConfirm(false);
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

  const handleToggleAutoHeal = async () => {
    try {
      await apiService.updateWorkerSettings(w.worker_id, { auto_restart: !w.auto_restart });
      onRefresh();
    } catch { }
  };

  const handleToggleAutoScale = async () => {
    try {
      await apiService.updateWorkerSettings(w.worker_id, { adaptive_scaling: w.adaptive_scaling === false });
      onRefresh();
    } catch { }
  };

  return (
    <>
      <div className={`worker-card ${stale ? "is-stale" : ""}`}>
        <div className="wc-indicator" style={{ background: dotColor }} />
        {stale && <div className="wc-offline-strip">DISCONNECTED</div>}

        <div className="wc-head" style={{ marginTop: stale ? 18 : 0 }}>
          <div>
            <div className="wc-id-row">
              <div className="wc-status-dot" style={{ background: dotColor }} />
              <span className="wc-id">{w.worker_id}</span>
            </div>
            <div className="wc-tags">
              <span className="wc-queue-chip">queue:{w.queue_name}</span>
              {w.auto_restart && (
                <Tooltip text="Automatically restarts on crash">
                  <span className="wc-flag f-heal">
                    <i className="ti ti-shield-check" style={{ fontSize: 10 }}></i>AUTO-HEAL
                  </span>
                </Tooltip>
              )}
              {w.adaptive_scaling !== false && (
                <Tooltip text="Adaptive scaling enabled">
                  <span className="wc-flag f-scale">
                    <i className="ti ti-chart-bar" style={{ fontSize: 10 }}></i>AUTO-SCALE
                  </span>
                </Tooltip>
              )}
            </div>
          </div>
          <span className={`status-badge ${badgeCls}`}>{badgeLbl}</span>
        </div>

        <div className="wc-stats">
          <div className="wc-stat">
            <div className="wc-stat-lbl">Processed</div>
            <div className="wc-stat-val" style={{ color: "var(--green)" }}>{w.jobs_processed}</div>
          </div>
          <div className="wc-stat">
            <div className="wc-stat-lbl">Failed</div>
            <div className="wc-stat-val" style={{ color: "var(--red)" }}>{w.jobs_failed}</div>
          </div>
          <div className="wc-stat">
            <div className="wc-stat-lbl">Slots</div>
            <div className="wc-stat-val" style={{ color: "var(--blue)" }}>{slotsUsed}/{w.concurrency}</div>
          </div>
          <div className="wc-stat">
            <div className="wc-stat-lbl">Success</div>
            <div className="wc-stat-val" style={{ color: rate >= 80 ? "var(--green)" : "var(--red)" }}>{rate}%</div>
          </div>
        </div>

        <div className="wc-util">
          <div className="wc-util-head">
            <span>UTILIZATION</span>
            <span>{slotsUsed}/{w.concurrency} SLOTS</span>
          </div>
          <div className="cap-bar">
            {Array.from({ length: w.concurrency }).map((_, i) => (
              <div
                key={i}
                className={`cap-seg ${i < slotsUsed ? "filled" : ""}`}
              />
            ))}
          </div>
        </div>

        <div className="wc-toggles">
          <div className={`tgl-row ${w.auto_restart ? "on" : ""}`} onClick={handleToggleAutoHeal}>
            <div className="tgl-switch"></div>
            <span className="tgl-label">🛡️ Auto-Heal</span>
          </div>
          <div className={`tgl-row scale ${w.adaptive_scaling !== false ? "on" : ""}`} onClick={handleToggleAutoScale}>
            <div className="tgl-switch"></div>
            <span className="tgl-label">📊 Auto-Scale</span>
          </div>
        </div>

        {w.active_job_ids.length > 0 && (
          <div className="wc-jobs">
            <div className="wc-jobs-lbl">Active Jobs</div>
            <div className="wc-job-chips">
              {w.active_job_ids.map(id => (
                <span key={id} className="wc-job-chip">{id.substring(0, 8)}</span>
              ))}
            </div>
          </div>
        )}

        <div className="wc-foot">
          <Tooltip text={`Started: ${new Date(w.started_at).toLocaleString()}`}>
            <span className="wc-ago">
              Active {ago(w.last_activity, now)}
            </span>
          </Tooltip>
          <div className="wc-actions">
            {w.status !== "stopped" && !stale ? (
              <>
                <button className="btn-pill danger" onClick={handleCrash} disabled={crashing}>
                  <i className="ti ti-bug"></i>Crash
                </button>
                <div style={{ position: "relative" }}>
                  <button className="btn-pill" onClick={() => setMenu(!menu)}>
                    <i className="ti ti-player-stop"></i>Stop
                  </button>
                  {menu && (
                    <div className="stop-menu" onMouseLeave={() => setMenu(false)}>
                      <button onClick={() => handleStopClick()}>Manual Stop</button>
                      <button onClick={() => handleStopClick({ auto_restart: true })}>Auto-Restart</button>
                      <button onClick={() => handleStopClick({ restart_in: 30 })}>Restart in 30s</button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <button className="btn-pill success" onClick={handleStart}>
                  <i className="ti ti-player-play"></i>Start
                </button>
                <button className="btn-pill danger" onClick={() => setRemoveConfirm(true)}>
                  <i className="ti ti-trash"></i>Remove
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={removeConfirm}
        onCancel={() => setRemoveConfirm(false)}
        onConfirm={confirmRemove}
        title="Remove Worker"
        message={`Remove "${w.worker_id}" from the registry? This will permanently deregister the worker node.`}
        confirmLabel="Remove Worker"
        variant="danger"
        loading={removing}
      />
    </>
  );
}
