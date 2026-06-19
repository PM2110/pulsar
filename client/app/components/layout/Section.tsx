"use client";

import React from "react";

interface SectionProps {
  label?: string;
  children: React.ReactNode;
  className?: string;
}

export function Section({ label, children, className }: SectionProps) {
  return (
    <div className={`pls-section ${className || ""}`}>
      {label && <div className="pls-section-label">{label}</div>}
      {children}
    </div>
  );
}
