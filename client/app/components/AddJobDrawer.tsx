import React, { useState } from "react";
import { apiService } from "../lib/api.service";

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
    setSaving(true);
    setErr(null);
    try {
      let payload;
      try {
        payload = JSON.parse(form.payload);
      } catch {
        setErr("Invalid JSON payload");
        setSaving(false);
        return;
      }
      await apiService.createJob({ ...form, payload });
      onAdded();
      onClose();
    } catch (e: any) {
      setErr(e.message || "Failed to create job");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer">
        <div
          style={{
            padding: "20px 24px 16px",
            borderBottom: "1px solid var(--border)",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}
        >
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>Add Job</h2>
          <button className="btn btn-ghost" onClick={onClose} style={{ padding: "4px 10px" }}>✕</button>
        </div>
        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label className="label">Queue</label>
            <select className="select" value={form.queue_name} onChange={(e) => handleQueueChange(e.target.value)}>
              {QUEUES.map((q) => <option key={q} value={q}>{q}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Job Type</label>
            <select className="select" value={form.job_type} onChange={(e) => setForm((f) => ({ ...f, job_type: e.target.value }))}>
              {availableTypes.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Payload (JSON)</label>
            <textarea
              className="textarea"
              value={form.payload}
              onChange={(e) => setForm((f) => ({ ...f, payload: e.target.value }))}
              style={{ fontFamily: "monospace", fontSize: 12, height: 100 }}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label className="label">Priority: {form.priority}</label>
              <input type="range" min={0} max={10} value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: Number(e.target.value) }))} style={{ width: "100%" }} />
            </div>
            <div>
              <label className="label">Max attempts</label>
              <input type="number" className="input" min={1} max={10} value={form.max_attempts} onChange={(e) => setForm((f) => ({ ...f, max_attempts: Number(e.target.value) }))} />
            </div>
          </div>
          <div>
            <label className="label">Failure mode</label>
            <select className="select" value={form.failure_mode} onChange={(e) => setForm((f) => ({ ...f, failure_mode: e.target.value }))}>
              <option value="succeed">Always succeed</option>
              <option value="fail">Always fail</option>
              <option value="probably_fail">Probabilistic</option>
            </select>
          </div>
          {form.failure_mode === "probably_fail" && (
            <div>
              <label className="label">Fail probability: {(form.fail_probability * 100).toFixed(0)}%</label>
              <input type="range" min={0} max={1} step={0.05} value={form.fail_probability} onChange={(e) => setForm((f) => ({ ...f, fail_probability: Number(e.target.value) }))} style={{ width: "100%" }} />
            </div>
          )}
          {err && <p style={{ fontSize: 12, color: "var(--failed)" }}>{err}</p>}
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving} style={{ marginTop: 4 }}>
            {saving ? "Creating..." : "⚡ Create Job"}
          </button>
        </div>
      </div>
    </>
  );
};
