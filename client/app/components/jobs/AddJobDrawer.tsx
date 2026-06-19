"use client";

import React, { useState } from "react";
import { apiService } from "../../lib/api.service";
import { Drawer, Dropdown, Input, Textarea, Slider, Button } from "../ui";
import { BoltIcon } from "../icons";

const QUEUES = ["notifications", "media", "default"];
const JOB_TYPES: Record<string, string[]> = {
  notifications: ["email_send", "sms_send", "push_notify"],
  media: ["image_resize", "video_transcode", "thumbnail_gen", "video_extract_audio", "image_watermark"],
  default: ["data_export", "report_generate", "cache_warmup", "cleanup_task"],
};
const FAILURE_MODES = [
  { label: "Always succeed", value: "succeed" },
  { label: "Always fail", value: "fail" },
  { label: "Probabilistic", value: "probably_fail" },
];

export const AddJobDrawer = ({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) => {
  const [form, setForm] = useState({
    queue_name: "notifications",
    job_type: "email_send",
    payload: '{\n  "to": "user@example.com",\n  "subject": "Hello"\n}',
    priority: 5,
    max_attempts: 3,
    failure_mode: "probably_fail",
    fail_probability: 0.3,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const availableTypes = JOB_TYPES[form.queue_name] || JOB_TYPES.default;

  const handleQueueChange = (q: string) => {
    const types = JOB_TYPES[q] || JOB_TYPES.default;
    setForm(f => ({ ...f, queue_name: q, job_type: types[0] }));
  };

  const handleSubmit = async () => {
    setSaving(true); setErr(null);
    try {
      let payload;
      try { payload = JSON.parse(form.payload); }
      catch { setErr("Invalid JSON payload"); setSaving(false); return; }
      await apiService.createJob({ ...form, payload });
      onAdded(); onClose();
    } catch (e: any) { setErr(e.message || "Failed to create job"); }
    finally { setSaving(false); }
  };

  return (
    <Drawer open={true} onClose={onClose} title="Create New Job">
      {/* Queue + Job Type */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Dropdown
          label="Queue"
          options={QUEUES.map(q => ({ label: q, value: q }))}
          value={form.queue_name}
          onChange={handleQueueChange}
        />
        <Dropdown
          label="Job Type"
          options={availableTypes.map(t => ({ label: t, value: t }))}
          value={form.job_type}
          onChange={v => setForm(f => ({ ...f, job_type: v }))}
        />
      </div>

      {/* Payload */}
      <Textarea
        label="Payload (JSON)"
        value={form.payload}
        onChange={e => setForm(f => ({ ...f, payload: e.target.value }))}
        style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, minHeight: 110, color: "var(--green)" }}
        spellCheck={false}
      />

      {/* Priority + Max Attempts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Slider
          label="Priority"
          value={form.priority}
          onChange={v => setForm(f => ({ ...f, priority: v }))}
          min={0} max={10}
          showRange={false}
        />
        <Input
          label="Max Attempts"
          type="number"
          value={String(form.max_attempts)}
          onChange={e => setForm(f => ({ ...f, max_attempts: Math.max(1, Number(e.target.value)) }))}
          inputSize="md"
          min={1}
          max={20}
        />
      </div>

      {/* Failure Mode */}
      <Dropdown
        label="Failure Mode"
        options={FAILURE_MODES}
        value={form.failure_mode}
        onChange={v => setForm(f => ({ ...f, failure_mode: v }))}
      />

      {/* Fail Probability */}
      {form.failure_mode === "probably_fail" && (
        <Slider
          label="Fail Probability"
          value={form.fail_probability}
          onChange={v => setForm(f => ({ ...f, fail_probability: v }))}
          min={0} max={1} step={0.05}
          valueFormatter={v => `${(v * 100).toFixed(0)}%`}
          showRange={false}
        />
      )}

      {/* Error */}
      {err && (
        <div style={{
          background: "var(--red-dim)", border: "1px solid var(--red-ring)",
          color: "var(--red)", borderRadius: 6, padding: "9px 12px", fontSize: 12,
          display: "flex", alignItems: "center", gap: 7,
        }}>
          <i className="ti ti-alert-circle" style={{ fontSize: 13, flexShrink: 0 }} />
          {err}
        </div>
      )}

      {/* Submit */}
      <Button
        variant="primary"
        size="lg"
        onClick={handleSubmit}
        loading={saving}
        icon={<BoltIcon size={14} />}
        style={{ width: "100%", marginTop: 4 }}
      >
        Create Job
      </Button>
    </Drawer>
  );
};
