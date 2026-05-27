"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";

/* ─────────────────────────────────────────────
   POPPER TOOLTIP — portal-based with smart positioning
   ───────────────────────────────────────────── */
export function Tooltip({ text, children, delay = 200, style }: { text: string; children: React.ReactNode; delay?: number; style?: React.CSSProperties }) {
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
      <span ref={ref} onMouseEnter={handleEnter} onMouseLeave={handleLeave} style={{ display: "inline-flex", ...style }}>
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
   DROPDOWN — single & multi-select, portal-based with Popper positioning
   ───────────────────────────────────────────── */
export interface DropdownOption {
  label: string;
  value: string;
}

/* Shared positioning hook */
function useDropdownPosition(open: boolean, optionCount: number) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: 0, flip: false });

  const calcPos = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const menuH = Math.min(optionCount * 36 + 8, 280);
    const spaceBelow = window.innerHeight - r.bottom;
    const flip = spaceBelow < menuH && r.top > menuH;
    setMenuPos({ top: flip ? r.top : r.bottom + 4, left: r.left, width: r.width, flip });
  }, [optionCount]);

  useEffect(() => {
    if (!open) return;
    calcPos();
    window.addEventListener("scroll", calcPos, true);
    window.addEventListener("resize", calcPos);
    return () => {
      window.removeEventListener("scroll", calcPos, true);
      window.removeEventListener("resize", calcPos);
    };
  }, [open, calcPos]);

  return { triggerRef, menuRef, menuPos };
}

/* ── Single-select Dropdown ── */
interface SingleDropdownProps {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
  multiSelect?: false;
}

/* ── Multi-select Dropdown ── */
interface MultiDropdownProps {
  options: DropdownOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  style?: React.CSSProperties;
  multiSelect: true;
}

export type DropdownProps = SingleDropdownProps | MultiDropdownProps;

export function Dropdown(props: DropdownProps) {
  const { options, placeholder = "Select...", style } = props;
  const [open, setOpen] = useState(false);
  const { triggerRef, menuRef, menuPos } = useDropdownPosition(open, options.length);

  // Outside-click to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target as Node) &&
        menuRef.current && !menuRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, triggerRef, menuRef]);

  /* ─── Render trigger label ─── */
  let triggerContent: React.ReactNode;

  if (props.multiSelect) {
    const selected = props.value;
    if (selected.length === 0) {
      triggerContent = <span className="dropdown-trigger-label" style={{ color: "var(--text-faint)" }}>{placeholder}</span>;
    } else {
      const first = options.find(o => o.value === selected[0])?.label ?? selected[0];
      const rest = selected.length - 1;
      triggerContent = (
        <span className="dropdown-trigger-label" style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{first}</span>
          {rest > 0 && (
            <span className="dropdown-multi-badge">+{rest}</span>
          )}
        </span>
      );
    }
  } else {
    const label = options.find(o => o.value === props.value)?.label;
    triggerContent = (
      <span
        className="dropdown-trigger-label"
        style={!label ? { color: "var(--text-faint)" } : undefined}
      >
        {label ?? placeholder}
      </span>
    );
  }

  /* ─── Clear handler ─── */
  const hasValue = props.multiSelect ? props.value.length > 0 : props.value !== "";

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (props.multiSelect) {
      props.onChange([]);
    } else {
      (props as SingleDropdownProps).onChange("");
    }
    setOpen(false);
  };

  /* ─── Option click ─── */
  const handleOptionClick = (optValue: string) => {
    if (props.multiSelect) {
      const cur = props.value;
      const next = cur.includes(optValue) ? cur.filter(v => v !== optValue) : [...cur, optValue];
      props.onChange(next);
      // Keep menu open for multi-select
    } else {
      (props as SingleDropdownProps).onChange(optValue);
      setOpen(false);
    }
  };

  const isSelected = (optValue: string) =>
    props.multiSelect ? props.value.includes(optValue) : props.value === optValue;

  return (
    <>
      <button
        ref={triggerRef}
        className={`dropdown-trigger${open ? " open" : ""}`}
        style={style}
        onClick={() => setOpen(o => !o)}
        type="button"
      >
        {triggerContent}
        {hasValue ? (
          <span
            className="dropdown-clear"
            role="button"
            aria-label="Clear selection"
            onClick={handleClear}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </span>
        ) : (
          <svg className="dropdown-chevron" width="10" height="6" viewBox="0 0 10 6" fill="none">
            <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {open && typeof window !== "undefined" && createPortal(
        <div
          ref={menuRef}
          className="dropdown-menu"
          style={{
            position: "fixed",
            top: menuPos.flip ? undefined : menuPos.top,
            bottom: menuPos.flip ? window.innerHeight - menuPos.top : undefined,
            left: menuPos.left,
            width: menuPos.width,
            zIndex: 9998,
          }}
        >
          {options.map(opt => {
            const sel = isSelected(opt.value);
            return (
              <button
                key={opt.value}
                className={`dropdown-option${sel ? " selected" : ""}`}
                onClick={() => handleOptionClick(opt.value)}
                type="button"
              >
                {props.multiSelect ? (
                  /* Checkbox indicator for multi-select */
                  <span className={`dropdown-option-check${sel ? " checked" : ""}`} aria-hidden="true">
                    {sel && (
                      <svg width="8" height="7" viewBox="0 0 8 7" fill="none">
                        <path d="M1 3.5l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                ) : (
                  /* Checkmark indicator for single-select */
                  sel ? (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <span style={{ width: 12, flexShrink: 0 }} />
                  )
                )}
                {opt.label}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </>
  );
}

/* ─────────────────────────────────────────────
   CHECKBOX — styled to match the UI
   ───────────────────────────────────────────── */
export function Checkbox({
  checked, onChange, label, disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <label className={`ui-checkbox-label${disabled ? " disabled" : ""}`}>
      <span className={`ui-checkbox${checked ? " checked" : ""}`} aria-hidden="true">
        {checked && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path d="M1 4l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        disabled={disabled}
        style={{ position: "absolute", opacity: 0, width: 0, height: 0, pointerEvents: "none" }}
      />
      {label && <span className="ui-checkbox-text">{label}</span>}
    </label>
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
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
        </div>
      </button>
      <div className="acc-panel"><div className="acc-panel-inner">{children}</div></div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   SEARCH INPUT — with debounce, icon, and clear button
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
    if (debounceMs === 0) {
      onChange(v);
    } else {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => onChange(v), debounceMs);
    }
  };

  const handleClear = () => {
    clearTimeout(timer.current);
    setLocal("");
    onChange("");
  };

  useEffect(() => () => clearTimeout(timer.current), []);

  const currentValue = debounceMs === 0 ? value : local;

  return (
    <div className="search-wrap">
      {/* Search icon */}
      <svg className="search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        className={`search-input${currentValue ? " has-clear" : ""}`}
        type="text"
        placeholder={placeholder}
        value={currentValue}
        onChange={handleChange}
      />
      {/* Clear button — only when there's text */}
      {currentValue && (
        <button
          className="search-clear"
          onClick={handleClear}
          type="button"
          aria-label="Clear search"
          tabIndex={-1}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      )}
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
