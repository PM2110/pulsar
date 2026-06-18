"use client";

import React from "react";
import { CheckIcon } from "../icons";

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: React.ReactNode;
  disabled?: boolean;
  className?: string;
}

export function Checkbox({ checked, onChange, label, disabled, className }: CheckboxProps) {
  return (
    <label className={`pls-checkbox-label ${disabled ? "pls-checkbox-label--disabled" : ""} ${className || ""}`}>
      <span className={`pls-checkbox ${checked ? "pls-checkbox--checked" : ""}`} aria-hidden="true">
        {checked && <CheckIcon size={10} />}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="pls-checkbox-native"
      />
      {label && <span className="pls-checkbox-text">{label}</span>}
    </label>
  );
}
