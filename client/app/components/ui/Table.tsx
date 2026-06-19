"use client";

import React from "react";
import { SortArrowsIcon } from "../icons";

export type SortOrder = "asc" | "desc";

export interface SortState {
  key: string;
  order: SortOrder;
}

export interface Column<T> {
  header: string;
  accessor?: keyof T;
  sortable?: boolean;
  sortKey?: string;
  render?: (row: T) => React.ReactNode;
  width?: string;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
  isLoading?: boolean;
  sort?: SortState;
  onSort?: (key: string, order: SortOrder) => void;
  emptyMessage?: string;
  className?: string;
}

export const DataTable = <T extends { id?: string | number | null }>({
  columns,
  data,
  onRowClick,
  isLoading,
  sort,
  onSort,
  emptyMessage = "No records found",
  className,
}: TableProps<T>) => {
  const handleHeaderClick = (col: Column<T>) => {
    if (!col.sortable || !onSort) return;
    const key = col.sortKey ?? String(col.accessor ?? col.header);
    if (!sort || sort.key !== key) {
      onSort(key, "asc");
    } else {
      onSort(key, sort.order === "asc" ? "desc" : "asc");
    }
  };

  if (isLoading && data.length === 0) {
    return (
      <div className="pls-table-loading">Loading…</div>
    );
  }

  return (
    <div className={`pls-table-wrap ${className || ""}`}>
      <table className="pls-table">
        <thead>
          <tr>
            {columns.map((col, i) => {
              const key = col.sortKey ?? String(col.accessor ?? col.header);
              const isActive = !!sort && sort.key === key;
              return (
                <th
                  key={i}
                  onClick={() => handleHeaderClick(col)}
                  className={col.sortable ? "pls-table-th--sortable" : ""}
                  style={col.width ? { width: col.width } : undefined}
                >
                  <span className="pls-table-th-content">
                    {col.header}
                    {col.sortable && (
                      <SortArrowsIcon active={isActive} order={isActive ? sort!.order : undefined} />
                    )}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="pls-table-empty">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, i) => (
              <tr
                key={row.id ? String(row.id) : String(i)}
                onClick={() => onRowClick && onRowClick(row)}
                className={onRowClick ? "pls-table-row--clickable" : ""}
              >
                {columns.map((col, j) => (
                  <td key={j}>
                    {col.render ? col.render(row) : (col.accessor ? String(row[col.accessor]) : null)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};
