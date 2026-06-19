"use client";

import React, { useState } from "react";

const QUEUES = [
  { id: "notifications", name: "Notifications", icon: "ti-bell", color: "var(--blue)", colorHex: "#5B8AF0" },
  { id: "media", name: "Media", icon: "ti-movie", color: "var(--violet)", colorHex: "#9B7FE8" },
  { id: "default", name: "Default", icon: "ti-package", color: "var(--green)", colorHex: "#39C98A" },
];

interface QueueStats {
  depths: Record<string, number>;
  delayed: Record<string, number>;
  readyJobs: Record<string, { id: string; runAt: number; jobType?: string }[]>;
  delayedJobs: Record<string, { id: string; runAt: number; attempts: number; jobType?: string }[]>;
  processing: Record<string, { id: string; attempts: number; startedAt: number | null; workerId: string | null; workerHostname: string | null; jobType?: string }[]>;
}

interface QueueLanesProps {
  queues: QueueStats | undefined;
  now: number;
  selectedJobId: string | null;
  onSelectJob: (jobId: string) => void;
}

export function QueueLanes({ queues, now, selectedJobId, onSelectJob }: QueueLanesProps) {
  const [openQueues, setOpenQueues] = useState<Record<string, boolean>>({
    notifications: true,
    media: true,
    default: true,
  });

  const [openSubs, setOpenSubs] = useState<Record<string, boolean>>({
    "notifications-processing": true,
    "notifications-ready": true,
    "notifications-delayed": true,
    "media-processing": true,
    "media-ready": true,
    "media-delayed": true,
    "default-processing": true,
    "default-ready": true,
    "default-delayed": true,
  });

  const toggleQueue = (qId: string) => {
    setOpenQueues((prev) => ({ ...prev, [qId]: !prev[qId] }));
  };

  const toggleSub = (key: string) => {
    setOpenSubs((prev) => ({ ...prev, [key]: !prev[key] }));
  };



  const dl = (runAt: number) => {
    const s = Math.max(0, Math.round((runAt - now) / 1000));
    return s >= 60 ? `in ${Math.floor(s / 60)}m` : `in ${s}s`;
  };

  return (
    <div className="queue-columns">
      {QUEUES.map((q) => {
        const proc = queues?.processing[q.id] || [];
        const ready = queues?.readyJobs[q.id] || [];
        const delItems = queues?.delayedJobs[q.id] || [];
        const tot = proc.length + ready.length + delItems.length;

        const pp = tot > 0 ? (proc.length / tot) * 100 : 0;
        const rp = tot > 0 ? (ready.length / tot) * 100 : 0;
        const dp = tot > 0 ? (delItems.length / tot) * 100 : 0;

        const renderSubSection = (
          group: "processing" | "ready" | "delayed",
          label: string,
          dotColor: string,
          jobs: any[],
          statusKey: string
        ) => {
          if (!jobs.length) return null;
          const key = `${q.id}-${group}`;
          const isClosed = !openSubs[key];

          return (
            <div className={`qsub ${isClosed ? "closed" : ""}`}>
              <div className="qsub-head" onClick={() => toggleSub(key)}>
                <span className="qsub-label">
                  <span className="sdot" style={{ background: dotColor }}></span>
                  {label}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span className="qsub-count">{jobs.length}</span>
                  <i className="ti ti-chevron-down qsub-chev"></i>
                </div>
              </div>
              <div className="qsub-list">
                {jobs.map((j) => {
                  const badgeCls =
                    statusKey === "processing"
                      ? "jrb-proc"
                      : statusKey === "pending"
                      ? "jrb-ready"
                      : "jrb-delay";
                  const rowCls =
                    statusKey === "processing"
                      ? "s-proc"
                      : statusKey === "pending"
                      ? "s-ready"
                      : "s-delay";
                  const rowLabel =
                    statusKey === "processing"
                      ? "Active"
                      : statusKey === "pending"
                      ? "Ready"
                      : dl(j.runAt);
                  const isActive = selectedJobId === j.id;

                  return (
                    <div
                      key={j.id}
                      className={`job-row ${rowCls} ${isActive ? "active-row" : ""}`}
                      onClick={() => onSelectJob(j.id)}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="jr-type">{j.jobType || "Job"}</div>
                        <div className="jr-id">#{String(j.id).slice(0, 8)}</div>
                      </div>
                      <span className={`jr-badge ${badgeCls}`}>{rowLabel}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        };

        return (
          <div key={q.id} className="queue-column">
            <div className="qacc-head">
              <div className="qacc-icon" style={{ background: "rgba(255,255,255,.04)", border: "1px solid var(--b1)" }}>
                <i className={`ti ${q.icon}`} style={{ color: q.color, fontSize: 12 }}></i>
              </div>
              <span className="qacc-name">{q.name}</span>
              <div className="qacc-pills">
                {proc.length > 0 && <span className="stat-pip pip-blue">{proc.length}</span>}
                {ready.length > 0 && <span className="stat-pip pip-gray">{ready.length}</span>}
                {delItems.length > 0 && <span className="stat-pip pip-amber">{delItems.length}</span>}
              </div>
            </div>
            <div className="qacc-body">
              {tot === 0 ? (
                <div className="empty-state" style={{ padding: "40px 10px", textAlign: "center" }}>
                  <i className="ti ti-mood-empty empty-icon" style={{ fontSize: 24 }}></i>
                  <div className="empty-label" style={{ fontSize: 11, fontWeight: 500 }}>Queue Idle</div>
                  <div className="empty-sub" style={{ fontSize: 10 }}>No pending workflow load</div>
                </div>
              ) : (
                <>
                  {renderSubSection("processing", "Processing", "#7BA8FF", proc, "processing")}
                  {renderSubSection("ready", "Ready", "var(--b3)", ready, "pending")}
                  {renderSubSection("delayed", "Delayed", "var(--amber)", delItems, "delayed")}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
