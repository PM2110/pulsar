"use client";

import React, { useEffect } from "react";
import { CloseIcon } from "../icons";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  width?: number;
}

export function Drawer({ open, onClose, title, children, width = 440 }: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="pls-drawer-overlay" onClick={onClose} />
      <div className="pls-drawer" style={{ width }}>
        {title && (
          <div className="pls-drawer-header">
            <h2 className="pls-drawer-title">{title}</h2>
            <button className="pls-btn pls-btn--ghost pls-btn--sm" onClick={onClose} aria-label="Close">
              <CloseIcon size={12} />
            </button>
          </div>
        )}
        <div className="pls-drawer-body">{children}</div>
      </div>
    </>
  );
}
