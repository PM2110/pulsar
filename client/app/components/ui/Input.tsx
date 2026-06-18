"use client";

import React from "react";

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string;
  error?: string;
  hint?: string;
  inputSize?: "sm" | "md" | "lg";
  leftIcon?: React.ReactNode;
}

export function Input({
  label,
  error,
  hint,
  inputSize = "md",
  leftIcon,
  className,
  id,
  ...rest
}: InputProps) {
  const inputId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, "-")}` : undefined);

  return (
    <div className={`pls-input-wrap ${className || ""}`}>
      {label && (
        <label className="pls-label" htmlFor={inputId}>
          {label}
        </label>
      )}
      <div className={`pls-input-container ${leftIcon ? "pls-input-container--icon" : ""}`}>
        {leftIcon && <span className="pls-input-icon">{leftIcon}</span>}
        <input
          id={inputId}
          className={`pls-input pls-input--${inputSize} ${error ? "pls-input--error" : ""}`}
          {...rest}
        />
      </div>
      {error && <p className="pls-input-error">{error}</p>}
      {hint && !error && <p className="pls-input-hint">{hint}</p>}
    </div>
  );
}

/* ─── Textarea ─── */
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({ label, error, className, id, ...rest }: TextareaProps) {
  const textareaId = id || (label ? `ta-${label.toLowerCase().replace(/\s+/g, "-")}` : undefined);

  return (
    <div className={`pls-input-wrap ${className || ""}`}>
      {label && (
        <label className="pls-label" htmlFor={textareaId}>
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        className={`pls-textarea ${error ? "pls-input--error" : ""}`}
        {...rest}
      />
      {error && <p className="pls-input-error">{error}</p>}
    </div>
  );
}
