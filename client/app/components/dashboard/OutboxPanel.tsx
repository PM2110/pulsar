"use client";

import React, { useState } from "react";

interface OutboxData {
  total: number;
  pending: number;
  processed: number;
  failed: number;
}

export function OutboxPanel({ outbox }: { outbox: OutboxData }) {
  const [open, setOpen] = useState(true);

  return (
    <div className={`ms-section ${!open ? "closed" : ""}`} id="ms-ob">
      <div className="ms-head" onClick={() => setOpen(!open)}>
        <span className="ms-title"><i className="ti ti-radio"></i>Outbox Relay</span>
        <i className="ti ti-chevron-down ms-chev"></i>
      </div>
      <div className="ms-body">
        <div className="ob-rows">
          <div className="ob-row"><span className="ob-lbl"><span className="dist-dot" style={{ background: "var(--t3)", display: "inline-block", width: 6, height: 6, borderRadius: "50%" }}></span>Pipeline pending</span><span className="ob-val" style={{ color: "var(--t1)" }}>{outbox.pending.toLocaleString()}</span></div>
          <div className="ob-row"><span className="ob-lbl"><span className="dist-dot" style={{ background: "var(--green)", display: "inline-block", width: 6, height: 6, borderRadius: "50%" }}></span>Relayed</span><span className="ob-val" style={{ color: "var(--green)" }}>{outbox.processed.toLocaleString()}</span></div>
          <div className="ob-row"><span className="ob-lbl"><span className="dist-dot" style={{ background: "var(--red)", display: "inline-block", width: 6, height: 6, borderRadius: "50%" }}></span>Relay failed</span><span className="ob-val" style={{ color: "var(--red)" }}>{outbox.failed.toLocaleString()}</span></div>
        </div>
      </div>
    </div>
  );
}
