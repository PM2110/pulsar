"use client";

import React, { useState } from "react";
import { apiService } from "../../lib/api.service";

export function SeedJobs({ onSeeded }: { onSeeded: () => void }) {
  const [open, setOpen] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [seedForm, setSeedForm] = useState({ count: 10, queue_name: "", failure_mode: "" });
  const [seedMsg, setSeedMsg] = useState<string | null>(null);

  const handleSeed = async () => {
    setSeeding(true);
    setSeedMsg(null);
    try {
      const body: Record<string, unknown> = { count: seedForm.count };
      if (seedForm.queue_name) body.queue_name = seedForm.queue_name;
      if (seedForm.failure_mode) body.failure_mode = seedForm.failure_mode;
      const r = await apiService.seedJobs(body);
      setSeedMsg(`✓ Seeded ${r.count} jobs`);
      onSeeded();
    } catch {
      setSeedMsg("✗ Failed");
    } finally {
      setSeeding(false);
      setTimeout(() => setSeedMsg(null), 3000);
    }
  };

  return (
    <div className={`ms-section ${!open ? "closed" : ""}`} id="ms-seed">
      <div className="ms-head" onClick={() => setOpen(!open)}>
        <span className="ms-title"><i className="ti ti-bolt"></i>Seed Test Jobs</span>
        <i className="ti ti-chevron-down ms-chev"></i>
      </div>
      <div className="ms-body">
        <div className="seed-body">
          <div className="seed-label-row">Count <strong id="seed-out">{seedForm.count}</strong></div>
          <input 
            type="range" 
            min="1" 
            max="100" 
            value={seedForm.count} 
            onChange={(e) => setSeedForm(f => ({ ...f, count: parseInt(e.target.value) }))}
          />
          <select 
            className="seed-sel"
            value={seedForm.queue_name}
            onChange={(e) => setSeedForm(f => ({ ...f, queue_name: e.target.value }))}
          >
            <option value="">Queue: random</option>
            <option value="notifications">notifications</option>
            <option value="media">media</option>
            <option value="default">default</option>
          </select>
          <select 
            className="seed-sel"
            value={seedForm.failure_mode}
            onChange={(e) => setSeedForm(f => ({ ...f, failure_mode: e.target.value }))}
          >
            <option value="">Mode: random</option>
            <option value="succeed">Always succeed</option>
            <option value="fail">Always fail</option>
            <option value="probably_fail">Probabilistic</option>
          </select>
          <div className="seed-btns">
            <button className="seed-btn"><i className="ti ti-settings" style={{ fontSize: 11 }}></i>Configure</button>
            <button className="seed-btn primary" onClick={handleSeed} disabled={seeding}>
              <i className="ti ti-bolt" style={{ fontSize: 11 }}></i>{seeding ? "Seeding..." : `Seed ${seedForm.count}`}
            </button>
          </div>
          {seedMsg && (
            <div style={{ fontSize: 11, textAlign: "center", marginTop: 8, color: seedMsg.startsWith("✓") ? "var(--green)" : "var(--red)" }}>
              {seedMsg}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
