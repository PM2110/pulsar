"use client";

import React, { useState, useRef, useEffect } from "react";
import { SearchIcon, CloseIcon } from "../icons";

interface SearchBarProps {
  placeholder?: string;
  value: string;
  onChange: (val: string) => void;
  debounceMs?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function SearchBar({
  placeholder = "Search...",
  value,
  onChange,
  debounceMs = 300,
  className,
  style,
}: SearchBarProps) {
  const [local, setLocal] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

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
    <div className={`pls-search ${className || ""}`} style={style}>
      <SearchIcon className="pls-search-icon" />
      <input
        className={`pls-search-input ${currentValue ? "pls-search-input--clearable" : ""}`}
        type="text"
        placeholder={placeholder}
        value={currentValue}
        onChange={handleChange}
      />
      {currentValue && (
        <button
          className="pls-search-clear"
          onClick={handleClear}
          type="button"
          aria-label="Clear search"
          tabIndex={-1}
        >
          <CloseIcon size={10} />
        </button>
      )}
    </div>
  );
}
