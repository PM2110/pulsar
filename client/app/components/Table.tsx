import React from 'react';

export type SortOrder = 'asc' | 'desc';

export interface SortState {
  key: string;
  order: SortOrder;
}

export interface Column<T> {
  header: string;
  accessor?: keyof T;
  /** If true, renders sort arrows in the header. onSort must be provided on the Table. */
  sortable?: boolean;
  /** The key sent to onSort — defaults to String(accessor) if not provided */
  sortKey?: string;
  render?: (row: T) => React.ReactNode;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
  isLoading?: boolean;
  /** Current sort state — drives the active arrow highlighting */
  sort?: SortState;
  /** Called when a sortable header is clicked. Implement your API call here. */
  onSort?: (key: string, order: SortOrder) => void;
}

/* ── Sort arrows icon ─────────────────────────────────────── */
function SortArrows({ active, order }: { active: boolean; order?: SortOrder }) {
  return (
    <span className="sort-arrows" aria-hidden="true">
      <svg width="8" height="12" viewBox="0 0 8 12" fill="none" style={{ display: 'block' }}>
        {/* Up arrow */}
        <path
          d="M4 1L1 4.5H7L4 1Z"
          fill={active && order === 'asc' ? 'var(--text-primary)' : 'var(--text-faint)'}
        />
        {/* Down arrow */}
        <path
          d="M4 11L7 7.5H1L4 11Z"
          fill={active && order === 'desc' ? 'var(--text-primary)' : 'var(--text-faint)'}
        />
      </svg>
    </span>
  );
}

export const Table = <T extends { id?: string | number | null }>({
  columns, data, onRowClick, isLoading, sort, onSort,
}: TableProps<T>) => {

  const handleHeaderClick = (col: Column<T>) => {
    if (!col.sortable || !onSort) return;
    const key = col.sortKey ?? String(col.accessor ?? col.header);
    if (!sort || sort.key !== key) {
      onSort(key, 'asc');
    } else {
      onSort(key, sort.order === 'asc' ? 'desc' : 'asc');
    }
  };

  if (isLoading && data.length === 0) {
    return (
      <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
        Loading…
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <table className="table">
        <thead>
          <tr>
            {columns.map((col, i) => {
              const key = col.sortKey ?? String(col.accessor ?? col.header);
              const isActive = !!sort && sort.key === key;
              return (
                <th
                  key={i}
                  onClick={() => handleHeaderClick(col)}
                  className={col.sortable ? 'sortable-th' : ''}
                  style={col.sortable ? { cursor: 'pointer', userSelect: 'none' } : undefined}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    {col.header}
                    {col.sortable && (
                      <SortArrows active={isActive} order={isActive ? sort!.order : undefined} />
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
              <td colSpan={columns.length} style={{ textAlign: "center", padding: 32, color: "var(--text-muted)" }}>
                No records found
              </td>
            </tr>
          ) : (
            data.map((row, i) => (
              <tr
                key={row.id ? String(row.id) : String(i)}
                onClick={() => onRowClick && onRowClick(row)}
                style={{ cursor: onRowClick ? "pointer" : "default" }}
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
