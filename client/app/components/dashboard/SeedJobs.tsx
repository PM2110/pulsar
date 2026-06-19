"use client";

import React, { useState } from "react";
import { apiService } from "../../lib/api.service";
import { Dropdown } from "../ui/Dropdown";

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
          <Dropdown
            options={[
              { label: "Queue: random", value: "" },
              { label: "Notifications", value: "notifications" },
              { label: "Media", value: "media" },
              { label: "Default", value: "default" },
            ]}
            value={seedForm.queue_name}
            onChange={(val) => setSeedForm(f => ({ ...f, queue_name: val }))}
            multiSelect={false}
            placeholder="Queue: random"
            style={{ marginBottom: 8 }}
          />
          <Dropdown
            options={[
              { label: "Mode: random", value: "" },
              { label: "Always succeed", value: "succeed" },
              { label: "Always fail", value: "fail" },
              { label: "Probabilistic", value: "probably_fail" },
            ]}
            value={seedForm.failure_mode}
            onChange={(val) => setSeedForm(f => ({ ...f, failure_mode: val }))}
            multiSelect={false}
            placeholder="Mode: random"
            style={{ marginBottom: 8 }}
          />
          <div className="seed-btns">
            <button className="seed-btn primary" style={{ width: "100%" }} onClick={handleSeed} disabled={seeding}>
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
