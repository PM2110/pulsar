"use client";

import React, { useState, useRef, useEffect } from "react";

interface AnimatedNumberProps {
  value: number;
  duration?: number;
}

export function AnimatedNumber({ value, duration = 400 }: AnimatedNumberProps) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);

  useEffect(() => {
    const start = prev.current;
    const end = value;
    if (start === end) return;

    const diff = end - start;
    const steps = 16;
    const stepTime = duration / steps;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      setDisplay(Math.round(start + diff * (step / steps)));
      if (step >= steps) {
        clearInterval(timer);
        prev.current = end;
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, [value, duration]);

  return <>{display.toLocaleString()}</>;
}
