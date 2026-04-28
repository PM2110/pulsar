import React from "react";

interface PaginationProps {
  page: number;
  total: number;
  limit: number;
  setPage: (page: number) => void;
}

export const Pagination = ({ page, total, limit, setPage }: PaginationProps) => {
  const totalPages = Math.ceil(total / limit);
  if (totalPages <= 1) return null;

  const getVisiblePages = () => {
    const visible = new Set([0, totalPages - 1, page, page - 1, page + 1]);
    return Array.from(visible).filter((p) => p >= 0 && p < totalPages).sort((a, b) => a - b);
  };

  const visiblePages = getVisiblePages();

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16 }}>
      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
        Showing {Math.min(page * limit + 1, total)}–{Math.min((page + 1) * limit, total)} of {total}
      </span>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <button 
          className="btn btn-ghost" 
          style={{ padding: "4px 8px", fontSize: 13 }} 
          onClick={() => setPage(page - 1)} 
          disabled={page === 0}
        >
          ← Prev
        </button>
        {visiblePages.map((p, index) => {
          if (index > 0 && p !== visiblePages[index - 1] + 1) {
            return (
              <React.Fragment key={`gap-${p}`}>
                <span style={{ color: "var(--text-muted)", fontSize: 12, margin: "0 2px" }}>...</span>
                <button
                  className={`btn ${p === page ? "btn-primary" : "btn-ghost"}`}
                  style={{ padding: "4px 10px", fontSize: 12 }}
                  onClick={() => setPage(p)}
                >
                  {p + 1}
                </button>
              </React.Fragment>
            );
          }
          return (
            <button
              key={p}
              className={`btn ${p === page ? "btn-primary" : "btn-ghost"}`}
              style={{ padding: "4px 10px", fontSize: 12 }}
              onClick={() => setPage(p)}
            >
              {p + 1}
            </button>
          );
        })}
        <button
          className="btn btn-ghost"
          style={{ padding: "4px 8px", fontSize: 13 }}
          onClick={() => setPage(page + 1)}
          disabled={(page + 1) * limit >= total}
        >
          Next →
        </button>
      </div>
    </div>
  );
};
