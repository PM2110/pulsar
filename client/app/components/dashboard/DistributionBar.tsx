"use client";

import React, { useState } from "react";

export function DistributionBar({ total, stats }: { total: number; stats: any }) {
  const [open, setOpen] = useState(true);
  
  const p = stats?.jobs.processing ?? 0;
  const pend = stats?.jobs.pending ?? 0;
  const d = stats?.jobs.delayed ?? 0;
  const c = stats?.jobs.completed ?? 0;
  const f = stats?.jobs.failed ?? 0;

  const getPct = (val: number) => total > 0 ? ((val / total) * 100).toFixed(1) : "0.0";

  return (
    <div className={`ms-section ${!open ? "closed" : ""}`} id="ms-dist">
      <div className="ms-head" onClick={() => setOpen(!open)}>
        <span className="ms-title"><i className="ti ti-chart-donut"></i>Distribution</span>
        <i className="ti ti-chevron-down ms-chev"></i>
      </div>
      <div className="ms-body">
        <div className="dist-bar">
          <div className="dist-seg" style={{ width: `${getPct(p)}%`, background: "var(--blue)" }}></div>
          <div className="dist-seg" style={{ width: `${getPct(pend)}%`, background: "var(--t3)" }}></div>
          <div className="dist-seg" style={{ width: `${getPct(d)}%`, background: "var(--amber)" }}></div>
          <div className="dist-seg" style={{ width: `${getPct(c)}%`, background: "var(--green)" }}></div>
          <div className="dist-seg" style={{ width: `${getPct(f)}%`, background: "var(--red)" }}></div>
        </div>
        <div className="dist-rows">
          <div className="dist-row">
            <div className="dist-dot" style={{ background: "#7BA8FF", animation: p > 0 ? "blink 1.5s infinite" : "none" }}></div>
            <span className="dist-name">Processing</span>
            <span className="dist-num">{p}</span>
            <span className="dist-pct">{getPct(p)}%</span>
          </div>
          <div className="dist-row">
            <div className="dist-dot" style={{ background: "var(--t3)" }}></div>
            <span className="dist-name">Pending</span>
            <span className="dist-num">{pend}</span>
            <span className="dist-pct">{getPct(pend)}%</span>
          </div>
          <div className="dist-row">
            <div className="dist-dot" style={{ background: "var(--amber)" }}></div>
            <span className="dist-name">Delayed</span>
            <span className="dist-num">{d}</span>
            <span className="dist-pct">{getPct(d)}%</span>
          </div>
          <div className="dist-row">
            <div className="dist-dot" style={{ background: "var(--green)" }}></div>
            <span className="dist-name">Completed</span>
            <span className="dist-num">{c.toLocaleString()}</span>
            <span className="dist-pct">{getPct(c)}%</span>
          </div>
          <div className="dist-row">
            <div className="dist-dot" style={{ background: "var(--red)" }}></div>
            <span className="dist-name">Failed</span>
            <span className="dist-num">{f}</span>
            <span className="dist-pct">{getPct(f)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
