"use client";

import React, { useState } from "react";
import { apiService } from "../../lib/api.service";
import { Dropdown, Button, Input, Textarea, Slider, Checkbox, Drawer } from "../ui";
import { BoltIcon } from "../icons";

const QUEUES = ["notifications", "media", "default"];
const JOB_TYPES: Record<string, string[]> = {
  notifications: ["email_send", "sms_send", "push_notify"],
  media: ["image_resize", "video_transcode", "thumbnail_gen", "video_extract_audio", "image_watermark"],
  default: ["data_export", "report_generate", "cache_warmup", "cleanup_task"],
};

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
    setForm((f) => ({ ...f, queue_name: q, job_type: types[0] }));
  };

  const handleSubmit = async () => {
    setSaving(true); setErr(null);
    try {
      let payload;
      try { payload = JSON.parse(form.payload); } catch { setErr("Invalid JSON payload"); setSaving(false); return; }
      await apiService.createJob({ ...form, payload });
      onAdded(); onClose();
    } catch (e: any) { setErr(e.message || "Failed to create job"); }
    finally { setSaving(false); }
  };

  return (
    <Drawer open={true} onClose={onClose} title="Add Job">
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
        onChange={(v) => setForm(f => ({ ...f, job_type: v }))}
      />
      <Textarea
        label="Payload (JSON)"
        value={form.payload}
        onChange={(e) => setForm(f => ({ ...f, payload: e.target.value }))}
        style={{ fontFamily: "monospace", fontSize: 12, height: 100 }}
      />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Slider label={`Priority`} value={form.priority} onChange={(v) => setForm(f => ({ ...f, priority: v }))} min={0} max={10} showRange={false} />
        <Input label="Max attempts" type="number" value={String(form.max_attempts)} onChange={(e) => setForm(f => ({ ...f, max_attempts: Number(e.target.value) }))} inputSize="md" />
      </div>
      <Dropdown
        label="Failure mode"
        options={[
          { label: "Always succeed", value: "succeed" },
          { label: "Always fail", value: "fail" },
          { label: "Probabilistic", value: "probably_fail" },
        ]}
        value={form.failure_mode}
        onChange={(v) => setForm(f => ({ ...f, failure_mode: v }))}
      />
      {form.failure_mode === "probably_fail" && (
        <Slider
          label="Fail probability"
          value={form.fail_probability}
          onChange={(v) => setForm(f => ({ ...f, fail_probability: v }))}
          min={0} max={1} step={0.05}
          valueFormatter={(v) => `${(v * 100).toFixed(0)}%`}
          showRange={false}
        />
      )}
      {err && <p style={{ fontSize: 12, color: "var(--danger)" }}>{err}</p>}
      <Button variant="primary" size="lg" onClick={handleSubmit} loading={saving} icon={<BoltIcon size={14} />} style={{ width: "100%", marginTop: 4 }}>
        Create Job
      </Button>
    </Drawer>
  );
};
