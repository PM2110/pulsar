"use client";

import React from "react";

interface ScalingConfigProps {
  queues: string[];
  asc: Record<string, any>;
}

export function ScalingConfig({ queues, asc }: ScalingConfigProps) {
  return (
    <div className="rail-card" style={{ borderBottom: "none" }}>
      <div className="rail-card-title">
        <i className="ti ti-chart-bar"></i>Adaptive Scaling
      </div>
      <div style={{ fontSize: "11px", color: "var(--t2)", marginBottom: "12px", marginTop: "-4px" }}>
        Autoscaler policy status per queue
      </div>
      <div>
        {queues.map((q) => {
          const c = asc[q] || { enabled: false };
          return (
            <div key={q} className={`policy-row ${c.enabled ? "" : "off"}`}>
              <span className="policy-q">{q}</span>
              <span className={`policy-badge ${c.enabled ? "active" : "inactive"}`}>
                {c.enabled ? "ACTIVE" : "OFF"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
