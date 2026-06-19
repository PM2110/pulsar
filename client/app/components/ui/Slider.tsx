"use client";

import React from "react";

interface SliderProps {
  label?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  showValue?: boolean;
  showRange?: boolean;
  valueFormatter?: (v: number) => string;
  className?: string;
}

export function Slider({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  showValue = true,
  showRange = true,
  valueFormatter,
  className,
}: SliderProps) {
  const displayValue = valueFormatter ? valueFormatter(value) : String(value);
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div className={`pls-slider-wrap ${className || ""}`}>
      {(label || showValue) && (
        <div className="pls-slider-header">
          {label && <label className="pls-label">{label}</label>}
          {showValue && <span className="pls-slider-value">{displayValue}</span>}
        </div>
      )}
      <input
        type="range"
        className="pls-slider"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          background: `linear-gradient(to right, var(--blue) ${pct}%, var(--b2) ${pct}%)`,
        }}
      />
      {showRange && (
        <div className="pls-slider-range">
          <span>{min}</span>
          <span>{Math.round((max - min) / 2 + min)}</span>
          <span>{max}</span>
        </div>
      )}
    </div>
  );
}
