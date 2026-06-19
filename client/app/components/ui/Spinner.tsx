"use client";

import React from "react";

interface SpinnerProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function Spinner({ size = 14, className, style }: SpinnerProps) {
  return (
    <span
      className={`pls-spinner ${className || ""}`}
      style={{ width: size, height: size, borderWidth: Math.max(1.5, size / 7), ...style }}
      role="status"
      aria-label="Loading"
    />
  );
}
