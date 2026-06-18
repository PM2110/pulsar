"use client";

import React, { useEffect } from "react";
import { CloseIcon } from "../icons";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}

export function Modal({ open, onClose, children, className }: ModalProps) {
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
    <div className="pls-modal-overlay" onClick={onClose}>
      <div className={`pls-modal ${className || ""}`} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

/* ── Modal subcomponents for composition ── */
export function ModalHeader({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose?: () => void;
}) {
  return (
    <div className="pls-modal-header">
      <div className="pls-modal-header-content">{children}</div>
      {onClose && (
        <button className="pls-btn pls-btn--ghost pls-btn--sm" onClick={onClose} aria-label="Close">
          <CloseIcon size={14} />
        </button>
      )}
    </div>
  );
}

export function ModalBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={`pls-modal-body ${className || ""}`}>{children}</div>;
}
