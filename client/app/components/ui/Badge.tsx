"use client";

import React from "react";

type BadgeVariant = "pending" | "processing" | "completed" | "failed" | "default";

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

const VARIANT_CLASS: Record<BadgeVariant, string> = {
  pending: "pls-badge--pending",
  processing: "pls-badge--processing",
  completed: "pls-badge--completed",
  failed: "pls-badge--failed",
  default: "pls-badge--default",
};

export function Badge({ variant = "default", children, className, style }: BadgeProps) {
  return (
    <span className={`pls-badge ${VARIANT_CLASS[variant]} ${className || ""}`} style={style}>
      {children}
    </span>
  );
}

/** Convenience component that maps a status string to the right badge */
export function StatusBadge({ status }: { status: string }) {
  const variant = (["pending", "processing", "completed", "failed"].includes(status)
    ? status
    : "default") as BadgeVariant;
  return <Badge variant={variant}>{status}</Badge>;
}
