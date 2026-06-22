"use client";

import React, { useEffect } from "react";
import { createPortal } from "react-dom";

interface ConfirmDialogProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "info";
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onCancel,
  onConfirm,
  title = "Confirm Action",
  message = "Are you sure you want to proceed?",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  loading = false,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter") onConfirm();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onCancel, onConfirm]);

  if (!open || typeof window === "undefined") return null;

  const iconMap = {
    danger: { icon: "ti-trash", color: "var(--red)", bg: "var(--red-dim)", ring: "var(--red-ring)" },
    warning: { icon: "ti-alert-triangle", color: "var(--amber)", bg: "var(--amber-dim)", ring: "var(--amber-ring)" },
    info: { icon: "ti-info-circle", color: "#7BA8FF", bg: "var(--blue-dim)", ring: "var(--blue-ring)" },
  };

  const { icon, color, bg, ring } = iconMap[variant];

  return createPortal(
    <div
      className="cd-overlay"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cd-title"
    >
      <div className="cd-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Icon */}
        <div className="cd-icon-wrap" style={{ background: bg, border: `1px solid ${ring}` }}>
          <i className={`ti ${icon}`} style={{ color, fontSize: 18 }} />
        </div>

        {/* Content */}
        <div className="cd-body">
          <div id="cd-title" className="cd-title">{title}</div>
          <div className="cd-message">{message}</div>
        </div>

        {/* Actions */}
        <div className="cd-actions">
          <button className="cd-btn cd-btn-cancel" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </button>
          <button
            className="cd-btn cd-btn-confirm"
            style={{ background: bg, borderColor: ring, color }}
            onClick={onConfirm}
            disabled={loading}
            autoFocus
          >
            {loading ? (
              <span className="cd-spinner" />
            ) : (
              <i className={`ti ${icon}`} />
            )}
            {loading ? "Deleting…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
