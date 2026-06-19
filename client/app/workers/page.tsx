"use client";

import React, { useEffect, useState, useCallback } from "react";
import { apiService, socket } from "../lib/api.service";
import { WorkerCard } from "../components/workers/WorkerCard";
import { DeployPanel } from "../components/workers/DeployPanel";
import { ScalingConfig } from "../components/workers/ScalingConfig";
import { WorkerInfo } from "../types";
import { SearchBar } from "../components/ui/SearchBar";
import { Tooltip } from "../components/ui/Tooltip";

const QUEUES = ["notifications", "media", "default"];

export default function WorkersPage() {
  const [workers, setWorkers] = useState<WorkerInfo[]>([]);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"all" | "active" | "inactive">("all");
  const [seedForm, setSeedForm] = useState({ count: 5, queue_name: "", failure_mode: "" });
  const [seeding, setSeeding] = useState(false);
  const [asc, setAsc] = useState<Record<string, any>>({});
  const [now, setNow] = useState(Date.now());

  const fetchWorkers = useCallback(async () => {
    try {
      const d = await apiService.getWorkers();
      setWorkers(d.workers || []);
      const s = await apiService.getAutoscalerConfig();
      setAsc(s.config || {});
    } catch { }
  }, []);

  useEffect(() => {
    fetchWorkers();
    const c = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(c);
  }, [fetchWorkers]);

  useEffect(() => {
    const handleUpdate = () => fetchWorkers();
    socket.on("stats_update", handleUpdate);
    socket.on("worker_update", handleUpdate);
    return () => {
      socket.off("stats_update", handleUpdate);
      socket.off("worker_update", handleUpdate);
    };
  }, [fetchWorkers]);

  const isStale = (w: WorkerInfo) => {
    return w.status !== "stopped" && (now - new Date(w.last_activity).getTime() > 30000);
  };

  const active = workers.filter(w => w.status !== "stopped" && !isStale(w));
  const inactive = workers.filter(w => w.status === "stopped" || isStale(w));

  const match = (w: WorkerInfo) => !search || w.worker_id.toLowerCase().includes(search.toLowerCase()) || w.queue_name.toLowerCase().includes(search.toLowerCase());

  const injectLoadShortcut = async () => {
    setSeeding(true);
    try {
      await apiService.seedJobs({ count: 5 });
    } catch { }
    setSeeding(false);
  };

  const groups = [];
  if (view === "all" || view === "active") {
    groups.push({ label: "Active Workers", list: active.filter(match), key: "active" });
  }
  if (view === "all" || view === "inactive") {
    groups.push({ label: "Inactive Workers", list: inactive.filter(match), key: "inactive" });
  }

  return (
    <div className="main-col">
      {/* TOPBAR */}
      <div className="topbar">
        <div className="topbar-title">
          <span className="eyebrow">Pulsar</span>
          <span style={{ color: "var(--b2)" }}>·</span>
          Worker Fleet
        </div>
        <div className="topbar-sep"></div>
        <div className="tb-pill">v2.0</div>
        <div className="topbar-sep"></div>
        <div className="tb-live">
          <span className="live-dot"></span>WebSocket Live
        </div>
        <div className="topbar-right">
          <Tooltip text="Refresh">
            <div className="tb-icon" onClick={fetchWorkers}>
              <i className="ti ti-refresh"></i>
            </div>
          </Tooltip>
        </div>
      </div>

      {/* METRIC RAIL */}
      <div className="metric-rail">
        <div className="mc">
          <div className="mc-label">
            <span className="wc-status-dot" style={{ background: "var(--green)" }} />
            Active Workers
          </div>
          <div className="mc-val" style={{ color: "var(--green)" }}>{active.length}</div>
          <div className="mc-sub">active now</div>
          <div className="mc-accent" style={{ background: "var(--green)", opacity: 0.5 }}></div>
        </div>
        <div className="mc">
          <div className="mc-label">Jobs Processed</div>
          <div className="mc-val">{workers.reduce((a, w) => a + w.jobs_processed, 0).toLocaleString()}</div>
          <div className="mc-sub">completed jobs</div>
        </div>
        <div className="mc">
          <div className="mc-label">System Failures</div>
          <div className="mc-val" style={{ color: "var(--red)" }}>{workers.reduce((a, w) => a + w.jobs_failed, 0)}</div>
          <div className="mc-sub">failed attempts</div>
          <div className="mc-accent" style={{ background: "var(--red)", opacity: 0.35 }}></div>
        </div>
        <div className="mc">
          <div className="mc-label">Inactive Workers</div>
          <div className="mc-val" style={{ color: "var(--t1)" }}>{inactive.length}</div>
          <div className="mc-sub">stopped / offline</div>
        </div>
      </div>

      {/* CONTROLS */}
      <div className="controls-section">
        <SearchBar
          placeholder="Search worker ID or queue..."
          value={search}
          onChange={setSearch}
          debounceMs={0}
          style={{ flex: "0 0 280px" }}
        />
        <div className="seg-toggle">
          <div className={`seg-btn ${view === "all" ? "on" : ""}`} onClick={() => setView("all")}>
            All <span className="cnt">{workers.length}</span>
          </div>
          <div className={`seg-btn ${view === "active" ? "on" : ""}`} onClick={() => setView("active")}>
            Active <span className="cnt">{active.length}</span>
          </div>
          <div className={`seg-btn ${view === "inactive" ? "on" : ""}`} onClick={() => setView("inactive")}>
            Inactive <span className="cnt">{inactive.length}</span>
          </div>
        </div>
        <div style={{ flex: 1 }}></div>
        <button className="btn-action" onClick={injectLoadShortcut} disabled={seeding}>
          <i className="ti ti-bolt"></i>{seeding ? "Injecting..." : "Inject Load"}
        </button>
      </div>

      <div className="body-split">
        {/* FLEET SCROLL */}
        <div className="fleet-scroll">
          {groups.map((g) => {
            const isEmpty = g.list.length === 0;
            return (
              <React.Fragment key={g.key}>
                <div className="fleet-group-label" style={{ marginTop: g.key === "inactive" ? 22 : 0 }}>
                  {g.label} <span className="cnt-pill">{g.list.length}</span>
                </div>
                {isEmpty ? (
                  <div className="empty-fleet">
                    <i className={`ti ${g.key === "active" ? "ti-server-off" : "ti-mood-empty"}`}></i>
                    {search
                      ? "No workers match your search"
                      : g.key === "active"
                        ? "No active workers. Deploy from the panel →"
                        : "No inactive workers"}
                  </div>
                ) : (
                  <div className="fleet-grid">
                    {g.list.map((w) => (
                      <WorkerCard
                        key={w.worker_id}
                        w={w}
                        now={now}
                        onRefresh={fetchWorkers}
                        onCrash={id => apiService.crashWorker(id)}
                        onStop={(id, o) => apiService.stopWorker(id, o)}
                      />
                    ))}
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* RIGHT CONTROL RAIL */}
        <div className="control-rail">
          <DeployPanel queues={QUEUES} onDeploySuccess={fetchWorkers} />

          {/* LOAD INJECTOR */}
          <div className="rail-card">
            <div className="rail-card-title">
              <i className="ti ti-bolt"></i>Load Injector
            </div>
            <div className="slider-row">
              <label className="field-label" style={{ margin: 0 }}>
                Job Count
              </label>
              <span className="slider-val">{seedForm.count}</span>
            </div>
            <input
              type="range"
              min="1"
              max="50"
              value={seedForm.count}
              onChange={(e) => setSeedForm((f) => ({ ...f, count: parseInt(e.target.value) }))}
            />
            <button
              className="btn-full"
              onClick={async () => {
                setSeeding(true);
                await apiService.seedJobs(seedForm);
                setSeeding(false);
              }}
              disabled={seeding}
            >
              <i className="ti ti-bolt" style={{ fontSize: 13 }}></i>
              {seeding ? "Injecting..." : "Inject Load"}
            </button>
          </div>

          <ScalingConfig queues={QUEUES} asc={asc} />
        </div>
      </div>
    </div>
  );
}