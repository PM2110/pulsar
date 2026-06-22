"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  arrow,
  Placement,
} from "@floating-ui/react-dom";

type TooltipPlacement = "top" | "bottom" | "left" | "right";

interface TooltipProps {
  text: string;
  children: React.ReactNode;
  delay?: number;
  placement?: TooltipPlacement;
  style?: React.CSSProperties;
  className?: string;
}

export function Tooltip({
  text,
  children,
  delay = 200,
  placement = "bottom",
  style,
  className,
}: TooltipProps) {
  const [show, setShow] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const arrowRef = useRef<HTMLDivElement>(null);

  const { refs, floatingStyles, middlewareData, placement: resolvedPlacement } = useFloating({
    placement: placement as Placement,
    open: show,
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(8),
      flip({ fallbackAxisSideDirection: "start", padding: 8 }),
      shift({ padding: 8 }),
      arrow({ element: arrowRef }),
    ],
  });

  const handleEnter = useCallback(() => {
    timer.current = setTimeout(() => setShow(true), delay);
  }, [delay]);

  const handleLeave = useCallback(() => {
    clearTimeout(timer.current);
    setShow(false);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  // Arrow position
  const arrowX = middlewareData.arrow?.x;
  const arrowY = middlewareData.arrow?.y;
  const side = resolvedPlacement.split("-")[0] as "top" | "bottom" | "left" | "right";
  const arrowSideStyle: React.CSSProperties = {
    position: "absolute",
    ...(side === "bottom" && { top: -4, left: arrowX != null ? arrowX : "50%", transform: "translateX(-50%) rotate(45deg)" }),
    ...(side === "top"    && { bottom: -4, left: arrowX != null ? arrowX : "50%", transform: "translateX(-50%) rotate(45deg)" }),
    ...(side === "left"   && { right: -4, top: arrowY != null ? arrowY : "50%", transform: "translateY(-50%) rotate(45deg)" }),
    ...(side === "right"  && { left: -4,  top: arrowY != null ? arrowY : "50%", transform: "translateY(-50%) rotate(45deg)" }),
    width: 8,
    height: 8,
    background: "var(--card3)",
    borderTop: side === "bottom" || side === "left" ? "1px solid var(--b2)" : "none",
    borderLeft: side === "bottom" || side === "right" ? "1px solid var(--b2)" : "none",
    borderBottom: side === "top" || side === "right" ? "1px solid var(--b2)" : "none",
    borderRight: side === "top" || side === "left" ? "1px solid var(--b2)" : "none",
  };

  return (
    <>
      <span
        ref={refs.setReference}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        style={{ display: "inline-flex", ...style }}
        className={className}
      >
        {children}
      </span>

      {show && typeof window !== "undefined" && createPortal(
        <div
          ref={refs.setFloating}
          className="pls-tooltip pls-tooltip--visible"
          style={{
            ...floatingStyles,
            position: "absolute",
          }}
          role="tooltip"
        >
          {text}
          <div ref={arrowRef} style={arrowSideStyle} />
        </div>,
        document.body
      )}
    </>
  );
}
