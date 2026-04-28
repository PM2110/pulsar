import React from 'react'

export const STATUS_CLASS: Record<string, string> = {
  pending: "badge-pending",
  processing: "badge-processing",
  completed: "badge-completed",
  failed: "badge-failed",
};

export const StatusBadge = ({ status }: { status: string }) => {
  return (
    <span className={`badge ${STATUS_CLASS[status] || "badge-pending"}`}>
      {status}
    </span>
  );
};
