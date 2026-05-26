"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";

/* ─────────────────────────────────────────────
   POPPER TOOLTIP — portal-based with smart positioning
   ───────────────────────────────────────────── */
export function Tooltip({ text, children, delay = 200 }: { text: string; children: React.ReactNode; delay?: number }) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const ref = useRef<HTMLSpanElement>(null);
  const timer = useRef<NodeJS.Timeout>(undefined);

  const handleEnter = useCallback(() => {
    timer.current = setTimeout(() => {
      if (!ref.current) return;
      const r = ref.current.getBoundingClientRect();
      setPos({ top: r.top - 8, left: r.left + r.width / 2 });
      setShow(true);
    }, delay);
  }, [delay]);

  const handleLeave = useCallback(() => {
    clearTimeout(timer.current);
    setShow(false);
  }, []);

  return (
    <>
      <span ref={ref} onMouseEnter={handleEnter} onMouseLeave={handleLeave} style={{ display: "inline-flex" }}>
        {children}
      </span>
      {show && typeof window !== "undefined" && createPortal(
        <div
          className="popper-tooltip visible"
          style={{ top: pos.top, left: pos.left, transform: "translate(-50%, -100%)" }}
        >
          {text}
        </div>,
        document.body
      )}
    </>
  );
}

/* ─────────────────────────────────────────────
   ACCORDION — with icon, description, badge, animated
   ───────────────────────────────────────────── */
export function Accordion({
  title, icon, desc, badge, defaultOpen = false, children, rightContent,
}: {
  title: string; icon?: React.ReactNode; desc?: string;
  badge?: React.ReactNode; defaultOpen?: boolean;
  children: React.ReactNode; rightContent?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`acc ${open ? "open" : ""}`}>
      <button className="acc-trigger" onClick={() => setOpen(!open)}>
        <div className="acc-trigger-left">
          {icon && <div className="acc-trigger-icon">{icon}</div>}
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span>{title}</span>
              {badge}
            </div>
            {desc && <div className="acc-trigger-desc">{desc}</div>}
          </div>
        </div>
        <div className="acc-trigger-right">
          {rightContent}
          <div className="acc-chev">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
        </div>
      </button>
      <div className="acc-panel"><div className="acc-panel-inner">{children}</div></div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   SEARCH INPUT — with debounce and icon
   ───────────────────────────────────────────── */
export function SearchInput({
  placeholder = "Search...", value, onChange, debounceMs = 300,
}: {
  placeholder?: string; value: string;
  onChange: (val: string) => void; debounceMs?: number;
}) {
  const [local, setLocal] = useState(value);
  const timer = useRef<NodeJS.Timeout>(undefined);

  useEffect(() => { setLocal(value); }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setLocal(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onChange(v), debounceMs);
  };

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <div className="search-wrap">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input className="search-input" type="text" placeholder={placeholder} value={local} onChange={handleChange} />
    </div>
  );
}

/* ─────────────────────────────────────────────
   ANIMATED NUMBER
   ───────────────────────────────────────────── */
export function AnimNum({ value }: { value: number }) {
  const [d, setD] = useState(value);
  const p = useRef(value);
  useEffect(() => {
    const s = p.current, e = value;
    if (s === e) return;
    const diff = e - s; let step = 0;
    const t = setInterval(() => { step++; setD(Math.round(s + diff * (step / 16))); if (step >= 16) { clearInterval(t); p.current = e; } }, 25);
    return () => clearInterval(t);
  }, [value]);
  return <>{d.toLocaleString()}</>;
}
