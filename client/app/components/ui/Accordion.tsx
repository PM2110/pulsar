"use client";

import React, { useState } from "react";
import { ChevronDownIcon } from "../icons";

interface AccordionProps {
  title: string;
  icon?: React.ReactNode;
  desc?: string;
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  rightContent?: React.ReactNode;
  className?: string;
}

export function Accordion({
  title,
  icon,
  desc,
  badge,
  defaultOpen = false,
  children,
  rightContent,
  className,
}: AccordionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`pls-acc ${open ? "pls-acc--open" : ""} ${className || ""}`}>
      <button className="pls-acc-trigger" onClick={() => setOpen(!open)}>
        <div className="pls-acc-trigger-left">
          {icon && <div className="pls-acc-trigger-icon">{icon}</div>}
          <div className="pls-acc-trigger-content">
            <div className="pls-acc-trigger-title-row">
              <span>{title}</span>
              {badge}
            </div>
            {desc && <div className="pls-acc-trigger-desc">{desc}</div>}
          </div>
        </div>
        <div className="pls-acc-trigger-right">
          {rightContent}
          <div className="pls-acc-chevron">
            <ChevronDownIcon />
          </div>
        </div>
      </button>
      <div className="pls-acc-panel">
        <div className="pls-acc-panel-inner">{children}</div>
      </div>
    </div>
  );
}
