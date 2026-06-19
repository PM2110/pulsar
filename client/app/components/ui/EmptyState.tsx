"use client";

import React from "react";

interface EmptyStateProps {
  message?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ message = "No data found", icon, action, className }: EmptyStateProps) {
  return (
    <div className={`pls-empty ${className || ""}`}>
      {icon && <div className="pls-empty-icon">{icon}</div>}
      <p className="pls-empty-text">{message}</p>
      {action && <div className="pls-empty-action">{action}</div>}
    </div>
  );
}
