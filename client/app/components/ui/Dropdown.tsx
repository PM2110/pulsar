"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { CloseIcon, ChevronDownIcon, CheckIcon } from "../icons";

/* ─── Types ─── */
export interface DropdownOption {
  label: string;
  value: string;
}

interface BaseDropdownProps {
  options: DropdownOption[];
  placeholder?: string;
  style?: React.CSSProperties;
  className?: string;
  label?: string;
}

interface SingleDropdownProps extends BaseDropdownProps {
  value: string;
  onChange: (value: string) => void;
  multiSelect?: false;
}

interface MultiDropdownProps extends BaseDropdownProps {
  value: string[];
  onChange: (value: string[]) => void;
  multiSelect: true;
}

export type DropdownProps = SingleDropdownProps | MultiDropdownProps;

/* ─── Positioning hook ─── */
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

/* ─── Component ─── */
export function Dropdown(props: DropdownProps) {
  const { options, placeholder = "Select...", style, className, label } = props;
  const [open, setOpen] = useState(false);
  const { triggerRef, menuRef, menuPos } = useDropdownPosition(open, options.length);

  // Close on outside click
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

  /* Trigger label */
  let triggerContent: React.ReactNode;
  if (props.multiSelect) {
    const selected = props.value;
    if (selected.length === 0) {
      triggerContent = <span className="pls-dd-label pls-dd-label--placeholder">{placeholder}</span>;
    } else {
      const first = options.find(o => o.value === selected[0])?.label ?? selected[0];
      const rest = selected.length - 1;
      triggerContent = (
        <span className="pls-dd-label">
          <span className="pls-dd-label-text">{first}</span>
          {rest > 0 && <span className="pls-dd-multi-badge">+{rest}</span>}
        </span>
      );
    }
  } else {
    const lbl = options.find(o => o.value === props.value)?.label;
    triggerContent = (
      <span className={`pls-dd-label ${!lbl ? "pls-dd-label--placeholder" : ""}`}>
        {lbl ?? placeholder}
      </span>
    );
  }

  const hasValue = props.multiSelect ? props.value.length > 0 : props.value !== "";

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (props.multiSelect) props.onChange([]);
    else (props as SingleDropdownProps).onChange("");
    setOpen(false);
  };

  const handleOptionClick = (optValue: string) => {
    if (props.multiSelect) {
      const cur = props.value;
      const next = cur.includes(optValue) ? cur.filter(v => v !== optValue) : [...cur, optValue];
      props.onChange(next);
    } else {
      (props as SingleDropdownProps).onChange(optValue);
      setOpen(false);
    }
  };

  const isSelected = (optValue: string) =>
    props.multiSelect ? props.value.includes(optValue) : props.value === optValue;

  return (
    <div className={`pls-dd-wrap ${className || ""}`}>
      {label && <label className="pls-label">{label}</label>}
      <button
        ref={triggerRef}
        className={`pls-dd-trigger ${open ? "pls-dd-trigger--open" : ""}`}
        style={style}
        onClick={() => setOpen(o => !o)}
        type="button"
      >
        {triggerContent}
        {hasValue ? (
          <span className="pls-dd-clear" role="button" aria-label="Clear" onClick={handleClear}>
            <CloseIcon size={9} />
          </span>
        ) : (
          <ChevronDownIcon className={`pls-dd-chevron ${open ? "pls-dd-chevron--open" : ""}`} />
        )}
      </button>

      {open && typeof window !== "undefined" && createPortal(
        <div
          ref={menuRef}
          className="pls-dd-menu"
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
                className={`pls-dd-option ${sel ? "pls-dd-option--selected" : ""}`}
                onClick={() => handleOptionClick(opt.value)}
                type="button"
              >
                {props.multiSelect ? (
                  <span className={`pls-dd-check ${sel ? "pls-dd-check--checked" : ""}`}>
                    {sel && <CheckIcon size={8} />}
                  </span>
                ) : (
                  sel ? <CheckIcon size={12} /> : <span style={{ width: 12, flexShrink: 0 }} />
                )}
                {opt.label}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}
