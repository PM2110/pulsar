"use client";

import React from "react";

interface ChipProps {
  children: React.ReactNode;
  variant?: "default" | "accent" | "success" | "danger" | "warning";
  className?: string;
  style?: React.CSSProperties;
}

export function Chip({ children, variant = "default", className, style }: ChipProps) {
  return (
    <span className={`pls-chip pls-chip--${variant} ${className || ""}`} style={style}>
      {children}
    </span>
  );
}
