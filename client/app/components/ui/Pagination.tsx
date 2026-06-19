"use client";

import React from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "../icons";

interface PaginationProps {
  page: number;
  total: number;
  limit: number;
  setPage: (page: number) => void;
  className?: string;
}

export function Pagination({ page, total, limit, setPage, className }: PaginationProps) {
  const totalPages = Math.ceil(total / limit);
  if (totalPages <= 1) return null;

  const getVisiblePages = () => {
    const visible = new Set([0, totalPages - 1, page, page - 1, page + 1]);
    return Array.from(visible).filter((p) => p >= 0 && p < totalPages).sort((a, b) => a - b);
  };

  const visiblePages = getVisiblePages();
  const from = Math.min(page * limit + 1, total);
  const to = Math.min((page + 1) * limit, total);

  return (
    <div className={`pls-pagination ${className || ""}`}>
      <span className="pls-pagination-info">
        Showing {from}–{to} of {total}
      </span>
      <div className="pls-pagination-controls">
        <button
          className="pls-pagination-btn"
          onClick={() => setPage(page - 1)}
          disabled={page === 0}
          aria-label="Previous page"
        >
          <ChevronLeftIcon size={12} />
          <span>Prev</span>
        </button>

        {visiblePages.map((p, index) => {
          const showGap = index > 0 && p !== visiblePages[index - 1] + 1;
          return (
            <React.Fragment key={p}>
              {showGap && <span className="pls-pagination-ellipsis">…</span>}
              <button
                className={`pls-pagination-btn pls-pagination-num ${p === page ? "pls-pagination-num--active" : ""}`}
                onClick={() => setPage(p)}
              >
                {p + 1}
              </button>
            </React.Fragment>
          );
        })}

        <button
          className="pls-pagination-btn"
          onClick={() => setPage(page + 1)}
          disabled={(page + 1) * limit >= total}
          aria-label="Next page"
        >
          <span>Next</span>
          <ChevronRightIcon size={12} />
        </button>
      </div>
    </div>
  );
}
