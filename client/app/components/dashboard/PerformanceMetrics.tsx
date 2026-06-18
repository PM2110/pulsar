"use client";

import React, { useState } from "react";

export function PerformanceMetrics({ throughput, stats }: { throughput: number; stats: any; metrics?: any }) {
  const [open, setOpen] = useState(true);

  return (
    <div className={`ms-section ${!open ? "closed" : ""}`} id="ms-perf">
      <div className="ms-head" onClick={() => setOpen(!open)}>
        <span className="ms-title"><i className="ti ti-activity"></i>Performance <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 3, background: "var(--card2)", border: "1px solid var(--b1)", color: "var(--t2)", fontWeight: 400, letterSpacing: 0, textTransform: "none", marginLeft: 2 }}>60s</span></span>
        <i className="ti ti-chevron-down ms-chev"></i>
      </div>
      <div className="ms-body">
        <div className="perf-grid">
          <div className="perf-cell"><div className="perf-lbl">Throughput</div><div className="perf-val" style={{ color: "var(--green)" }}>{throughput}<span className="perf-unit">j/m</span></div></div>
          <div className="perf-cell"><div className="perf-lbl">Avg exec</div><div className="perf-val">{Math.round(stats?.attempts?.avg_execution_ms ?? 0)}<span className="perf-unit">ms</span></div></div>
          <div className="perf-cell"><div className="perf-lbl">Q latency</div><div className="perf-val">{Math.round(stats?.attempts?.avg_latency_ms ?? 0)}<span className="perf-unit">ms</span></div></div>
          <div className="perf-cell"><div className="perf-lbl">Attempts</div><div className="perf-val">{(stats?.attempts?.total ?? 0).toLocaleString()}</div></div>
        </div>
      </div>
    </div>
  );
}
