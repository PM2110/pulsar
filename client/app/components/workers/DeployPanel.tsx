"use client";

import React, { useState } from "react";
import { apiService } from "../../lib/api.service";
import { Dropdown } from "../ui/Dropdown";

interface DeployPanelProps {
  queues: string[];
  onDeploySuccess: () => void;
}

export function DeployPanel({ queues, onDeploySuccess }: DeployPanelProps) {
  const [form, setForm] = useState({ queue_name: queues[0] || "notifications", worker_id: "api-node-01", auto_restart: true });
  const [starting, setStarting] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const handleStart = async () => {
    if (!form.worker_id.trim()) {
      setMsg({ text: "Worker ID required", ok: false });
      return;
    }
    setStarting(true);
    setMsg(null);
    try {
      const d = await apiService.startWorker(form);
      setMsg({ text: d.message || "Instance started", ok: true });
      setForm((f) => ({ ...f, worker_id: "api-node-0" + (Math.floor(Math.random() * 9) + 1) }));
      setTimeout(onDeploySuccess, 500);
    } catch (e: any) {
      setMsg({ text: e.message || "Failed to start worker", ok: false });
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="rail-card">
      <div className="rail-card-title">
        <i className="ti ti-rocket"></i>Deploy Instance
      </div>

      <div className="field">
        <label className="field-label">Queue</label>
        <Dropdown
          options={queues.map((q) => ({ label: q, value: q }))}
          value={form.queue_name}
          onChange={(val) => setForm((f) => ({ ...f, queue_name: val }))}
          multiSelect={false}
        />
      </div>

      <div className="field">
        <label className="field-label">Worker ID</label>
        <input
          type="text"
          className="field-input"
          placeholder="e.g. node-01"
          value={form.worker_id}
          onChange={(e) => setForm((f) => ({ ...f, worker_id: e.target.value }))}
        />
      </div>

      <div
        className={`checkbox-row ${form.auto_restart ? "checked" : ""}`}
        onClick={() => setForm((f) => ({ ...f, auto_restart: !f.auto_restart }))}
      >
        <div className="checkbox-box">
          <i className="ti ti-check" style={{ fontSize: 10 }}></i>
        </div>
        <span className="lbl">Auto-healing enabled</span>
      </div>

      {msg && (
        <div className={`deploy-msg ${msg.ok ? "ok" : "err"}`}>
          <i className={msg.ok ? "ti ti-circle-check" : "ti ti-circle-x"}></i>
          {msg.text}
        </div>
      )}

      <button className="btn-full" onClick={handleStart} disabled={starting}>
        <i className="ti ti-rocket" style={{ fontSize: 13 }}></i>
        {starting ? "Deploying..." : "Deploy Node"}
      </button>
    </div>
  );
}
