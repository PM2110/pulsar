"use client";

import React from "react";
import { Accordion, Badge } from "../ui";
import { BarChartIcon } from "../icons";

interface ScalingConfigProps {
  queues: string[];
  asc: Record<string, any>;
}

export function ScalingConfig({ queues, asc }: ScalingConfigProps) {
  return (
    <Accordion title="Adaptive Scaling" icon={<BarChartIcon />} desc="Autoscaler policy status per queue">
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {queues.map((q) => {
          const c = asc[q] || { enabled: false };
          return (
            <div
              key={q}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "8px 0",
                opacity: c.enabled ? 1 : 0.4,
              }}
            >
              <span style={{ fontSize: 12, fontFamily: "monospace", color: "var(--text-secondary)" }}>
                {q}
              </span>
              <Badge variant={c.enabled ? "completed" : "pending"} style={{ fontSize: 9 }}>
                {c.enabled ? "ACTIVE" : "OFF"}
              </Badge>
            </div>
          );
        })}
      </div>
    </Accordion>
  );
}
