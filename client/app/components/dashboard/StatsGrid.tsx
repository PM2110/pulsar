"use client";

import React from "react";
import { Tooltip, AnimatedNumber } from "../ui";

interface StatItem {
  label: string;
  value: number;
  color: string;
  barColor: string;
  tooltip: string;
}

export function StatsGrid({ items, total }: { items: StatItem[]; total: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
      {items.map((s) => (
        <Tooltip key={s.label} text={s.tooltip}>
          <div className="pls-hero-stat" style={{ width: "100%" }}>
            <div className="pls-hero-stat-label">
              <div className="pls-dot" style={{ background: s.barColor, width: 8, height: 8 }} />
              {s.label}
            </div>
            <div className="pls-hero-stat-value" style={{ color: s.color }}>
              <AnimatedNumber value={s.value} />
            </div>
            <div className="pls-hero-stat-sub">
              {total > 0 ? Math.round((s.value / total) * 100) : 0}% of {total.toLocaleString()} total jobs
            </div>
            <div className="pls-hero-stat-bar" style={{ background: s.barColor, opacity: 0.15 }} />
          </div>
        </Tooltip>
      ))}
    </div>
  );
}
