"use client";

import React, { useState } from "react";
import { Dropdown, Input, Checkbox, Button } from "../ui";
import { RocketIcon } from "../icons";
import { apiService } from "../../lib/api.service";

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
      setForm((f) => ({ ...f, worker_id: "" }));
      setTimeout(onDeploySuccess, 500);
    } catch (e: any) {
      setMsg({ text: e.message || "Failed to start worker", ok: false });
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="pls-card">
      <div className="pls-card-header">
        <span className="pls-card-title">Deploy Instance</span>
      </div>
      <div className="pls-card-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Dropdown
          label="Queue"
          options={queues.map((q) => ({ label: q, value: q }))}
          value={form.queue_name}
          onChange={(v) => setForm((f) => ({ ...f, queue_name: v }))}
        />

        <Input
          label="Worker ID"
          placeholder="e.g. node-01"
          value={form.worker_id}
          onChange={(e) => setForm((f) => ({ ...f, worker_id: e.target.value }))}
        />

        <Checkbox
          checked={form.auto_restart}
          onChange={(checked) => setForm((f) => ({ ...f, auto_restart: checked }))}
          label="Auto-healing enabled"
        />

        {msg && (
          <p style={{ fontSize: 11, color: msg.ok ? "var(--success)" : "var(--danger)" }}>
            {msg.text}
          </p>
        )}

        <Button
          variant="primary"
          size="lg"
          onClick={handleStart}
          disabled={starting}
          icon={<RocketIcon size={14} />}
          style={{ height: 42, width: "100%" }}
        >
          {starting ? "Starting..." : "Deploy Node"}
        </Button>
      </div>
    </div>
  );
}
