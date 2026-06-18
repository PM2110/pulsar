"use client";

import React, { useState } from "react";
import { InfiniteScroll } from "../InfiniteScroll";
import { formatTimeIST } from "../../lib/utils";

interface ExecutionHistoryProps {
  attempts: any[];
  totalAttempts: number;
  feedSearch: string;
  setFeedSearch: (v: string) => void;
  expandedIds: Record<string, boolean>;
  toggleExpand: (id: string) => void;
  feedRef: React.RefObject<HTMLDivElement | null>;
  loadMore: () => void;
  hasMore: boolean;
  loadingMore: boolean;
}

export function ExecutionHistory({
  attempts, totalAttempts, feedSearch, setFeedSearch,
  expandedIds, toggleExpand, feedRef, loadMore, hasMore, loadingMore,
}: ExecutionHistoryProps) {
  const [open, setOpen] = useState(true);

  return (
    <div className={`ms-section ${!open ? "closed" : ""}`} id="ms-feed">
      <div className="ms-head" onClick={() => setOpen(!open)}>
        <span className="ms-title"><i className="ti ti-terminal-2"></i>Execution Feed</span>
        <i className="ti ti-chevron-down ms-chev"></i>
      </div>
      <div className="ms-body">
        <div className="feed-search">
          <i className="ti ti-search feed-search-ico"></i>
          <input 
            className="feed-search-inp" 
            placeholder="Filter…" 
            value={feedSearch}
            onChange={(e) => setFeedSearch(e.target.value)}
          />
        </div>
        <div className="feed-list" ref={feedRef}>
          {attempts.length === 0 ? (
            <div style={{ textAlign: "center", padding: "30px 0", color: "var(--t2)", fontSize: 11 }}>
              {feedSearch ? "No matching logs" : "Waiting for jobs..."}
            </div>
          ) : attempts.map((h) => {
            const isExp = !!expandedIds[h.id];
            const ts = formatTimeIST(h.started_at);
            const qw = h.queue_latency_ms != null ? h.queue_latency_ms + 'ms' : '—';
            const ex = h.execution_time_ms != null ? h.execution_time_ms + 'ms' : (h.status === 'processing' ? 'live…' : '—');
            
            const mbCls = {
              processing: "mb-proc",
              completed: "mb-done",
              failed: "mb-fail"
            }[h.status as string] || "";
            
            const mbLbl = {
              processing: "Running",
              completed: "Done",
              failed: "Failed"
            }[h.status as string] || h.status;

            return (
              <div key={h.id}>
                <div className="feed-item" onClick={() => toggleExpand(h.id)}>
                  <span className="feed-ts">{ts}</span>
                  <div className="feed-body">
                    <div className="feed-top">
                      <span className="feed-q">[{h.queue_name}]</span>
                      <span className="feed-type">{h.job_type}</span>
                      <span className="feed-jid">#{String(h.job_id).slice(0, 8)}</span>
                    </div>
                    <div className="feed-detail">w:{h.worker_id || '—'} q:{qw} e:{ex}</div>
                  </div>
                  {mbCls && <span className={`mini-badge ${mbCls}`}>{mbLbl}</span>}
                  <i className={`ti ti-chevron-down feed-chev${isExp ? ' open' : ''}`}></i>
                </div>
                {isExp && (
                  <div className="feed-exp">
                    <div className="feed-exp-grid">
                      <div><div className="feed-ek">Scheduled</div><div className="feed-ev">{h.scheduled_at ? formatTimeIST(h.scheduled_at) : 'N/A'}</div></div>
                      <div><div className="feed-ek">Started</div><div className="feed-ev">{formatTimeIST(h.started_at)}</div></div>
                      <div><div className="feed-ek">Finished</div><div className="feed-ev">{h.finished_at ? formatTimeIST(h.finished_at) : '—'}</div></div>
                      <div><div className="feed-ek">Q·wait</div><div className={`feed-ev ${h.queue_latency_ms > 1000 ? "tm-slow" : "tm-fast"}`}>{qw}</div></div>
                      <div><div className="feed-ek">Exec</div><div className="feed-ev">{ex}</div></div>
                      <div><div className="feed-ek">Worker</div><div className="feed-ev">{h.worker_id || '—'} · PID {h.worker_pid || '—'}</div></div>
                    </div>
                    {h.error && (
                      <>
                        <div className="feed-ek" style={{ color: "var(--red)", marginBottom: 3 }}>Error</div>
                        <div style={{ fontSize: 10, fontFamily: "var(--mono)", color: "#D47878", wordBreak: "break-all" }}>{h.error}</div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          <InfiniteScroll onIntersect={loadMore} hasMore={hasMore} isLoading={loadingMore} rootRef={feedRef} />
        </div>
      </div>
    </div>
  );
}
