"use client";

import React from "react";
import { Tooltip, AnimatedNumber } from "../ui";

interface FleetOverviewProps {
  activeCount: number;
  processedCount: number;
  failedCount: number;
}

export function FleetOverview({ activeCount, processedCount, failedCount }: FleetOverviewProps) {
  const stats = [
    { l: "Active Nodes", v: activeCount, c: "var(--success)", tip: "Currently running worker instances" },
    { l: "Jobs Processed", v: processedCount, c: "var(--text-primary)", tip: "Total processed across all workers" },
    { l: "System Failures", v: failedCount, c: "var(--danger)", tip: "Total failures across fleet" },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
      {stats.map((s) => (
        <Tooltip key={s.l} text={s.tip}>
          <div className="pls-hero-stat" style={{ width: "100%" }}>
            <div className="pls-hero-stat-label">
              <div className="pls-dot" style={{ background: s.c, width: 8, height: 8 }} />
              {s.l}
            </div>
            <div className="pls-hero-stat-value" style={{ fontSize: 36, color: s.c }}>
              <AnimatedNumber value={s.v} />
            </div>
          </div>
        </Tooltip>
      ))}
    </div>
  );
}
