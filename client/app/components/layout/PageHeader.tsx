"use client";

import React from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode; // right-side actions
}

export function PageHeader({ title, subtitle, children }: PageHeaderProps) {
  return (
    <div className="pls-page-header">
      <div>
        <h1 className="pls-page-title">{title}</h1>
        {subtitle && <p className="pls-page-sub">{subtitle}</p>}
      </div>
      {children && <div className="pls-page-actions">{children}</div>}
    </div>
  );
}
