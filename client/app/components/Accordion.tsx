"use client";

import React, { useState } from "react";

/* Tooltip — uses CSS .tip class with data-tip attribute */
export function Tip({ text, children, bottom }: { text: string; children: React.ReactNode; bottom?: boolean }) {
  return (
    <span className={`tip ${bottom ? "tip-bottom" : ""}`} data-tip={text}>
      {children}
    </span>
  );
}

/* Accordion */
export function Acc({
  title, icon, desc, badge, right, open: defaultOpen = false, children,
}: {
  title: string; icon?: React.ReactNode; desc?: string;
  badge?: React.ReactNode; right?: React.ReactNode;
  open?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`acc ${open ? "open" : ""}`}>
      <button className="acc-head" onClick={() => setOpen(!open)}>
        <div className="acc-left">
          {icon && <div className="acc-icon">{icon}</div>}
          <div style={{ minWidth: 0 }}>
            <div className="acc-meta">
              <span>{title}</span>
              {badge}
            </div>
            {desc && <div className="acc-desc">{desc}</div>}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {right}
          <div className="acc-chev">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
        </div>
      </button>
      <div className="acc-body"><div className="acc-inner">{children}</div></div>
    </div>
  );
}
