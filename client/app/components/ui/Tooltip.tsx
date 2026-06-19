"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";

type Placement = "top" | "bottom";

interface TooltipProps {
  text: string;
  children: React.ReactNode;
  delay?: number;
  placement?: Placement;
  style?: React.CSSProperties;
  className?: string;
}

export function Tooltip({ text, children, delay = 250, placement = "top", style, className }: TooltipProps) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const ref = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const handleEnter = useCallback(() => {
    timer.current = setTimeout(() => {
      if (!ref.current) return;
      const r = ref.current.getBoundingClientRect();
      if (placement === "bottom") {
        setPos({ top: r.bottom + 8, left: r.left + r.width / 2 });
      } else {
        setPos({ top: r.top - 8, left: r.left + r.width / 2 });
      }
      setShow(true);
    }, delay);
  }, [delay, placement]);

  const handleLeave = useCallback(() => {
    clearTimeout(timer.current);
    setShow(false);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  const transform = placement === "bottom" ? "translateX(-50%)" : "translate(-50%, -100%)";

  return (
    <>
      <span
        ref={ref}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        style={{ display: "inline-flex", ...style }}
        className={className}
      >
        {children}
      </span>
      {show && typeof window !== "undefined" && createPortal(
        <div
          ref={tooltipRef}
          className={`pls-tooltip pls-tooltip--visible pls-tooltip--${placement}`}
          style={{ top: pos.top, left: pos.left, transform }}
        >
          {text}
        </div>,
        document.body
      )}
    </>
  );
}
