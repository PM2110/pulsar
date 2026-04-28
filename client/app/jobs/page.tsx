"use client";

import React, { useState } from "react";
import { useJobs } from "../hooks/useJobs";
import { Table, Column } from "../components/Table";
import { Pagination } from "../components/Pagination";
import { StatusBadge } from "../components/StatusBadge";
import { JobModal } from "../components/JobModal";
import { AddJobDrawer } from "../components/AddJobDrawer";
import { apiService } from "../lib/api.service";
import { formatTime } from "../lib/utils";
import { Job } from "../types";

const QUEUES = ["notifications", "media", "default"];
const LIMIT = 20;

const JobsPage = () => {
  const { jobs, total, page, setPage, statusFilter, setStatusFilter, queueFilter, setQueueFilter, loading, fetchJobs } = useJobs(LIMIT);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showAddDrawer, setShowAddDrawer] = useState(false);

  const deleteJob = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this job?")) return;
    await apiService.deleteJob(id);
    fetchJobs();
  };

  const retryJob = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await apiService.retryJob(id);
    fetchJobs();
  };

  const columns: Column<Job>[] = [
    {
      header: "ID",
      render: (job) => (
        <span className="mono" style={{ color: "var(--text-muted)" }}>
          #{job.id.slice(0, 8)}
        </span>
      ),
    },
    {
      header: "Type",
      render: (job) => <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{job.job_type}</span>,
    },
    {
      header: "Queue",
      render: (job) => <span className="mono" style={{ fontSize: 11 }}>{job.queue_name}</span>,
    },
    {
      header: "Status",
      render: (job) => <StatusBadge status={job.status} />,
    },
    {
      header: "Priority",
      render: (job) => <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{job.priority}</span>,
    },
    {
      header: "Attempts",
      render: (job) => (
        <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
          {Array.from({ length: job.max_attempts }).map((_, i) => {
            const attempted = i < job.attempts;
            const current = i === job.attempts - 1;
            let bg = "rgba(255,255,255,0.08)";
            if (attempted && current) {
              if (job.status === "completed") bg = "#22c55e";
              else if (job.status === "failed") bg = "var(--failed)";
              else if (job.status === "processing") bg = "rgba(255,255,255,0.6)";
              else bg = "rgba(239,68,68,0.45)";
            } else if (attempted) bg = "rgba(239,68,68,0.35)";
            return <div key={i} style={{ width: 6, height: 6, borderRadius: 2, background: bg, flexShrink: 0 }} />;
          })}
          <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: 4 }}>
            {job.attempts}/{job.max_attempts}
          </span>
        </div>
      ),
    },
    {
      header: "Mode",
      render: (job) => (
        <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
          {job.failure_mode}
          {job.fail_probability != null && ` (${Math.round(job.fail_probability * 100)}%)`}
        </span>
      ),
    },
    {
      header: "Created",
      render: (job) => <span style={{ fontSize: 11 }}>{formatTime(job.created_at)}</span>,
    },
    {
      header: "",
      render: (job) => (
        <div style={{ display: "flex", gap: 4 }}>
          {job.status === "failed" && (
            <button className="btn btn-ghost" style={{ padding: "3px 9px", fontSize: 11 }} onClick={(e) => retryJob(job.id, e)} title="Retry Job">↻</button>
          )}
          <button className="btn btn-ghost" style={{ padding: "3px 9px", fontSize: 11 }} onClick={(e) => deleteJob(job.id, e)} title="Delete Job">✕</button>
        </div>
      ),
    },
  ];

  return (
    <div style={{ padding: "28px 32px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Jobs</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{total} jobs · live refreshing via WebSocket</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddDrawer(true)}>+ Add Job</button>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <select className="select" style={{ width: 150 }} value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}>
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </select>
        <select className="select" style={{ width: 160 }} value={queueFilter} onChange={(e) => { setQueueFilter(e.target.value); setPage(0); }}>
          <option value="">All queues</option>
          {QUEUES.map((q) => <option key={q} value={q}>{q}</option>)}
        </select>
        <button className="btn btn-ghost" onClick={() => { setStatusFilter(""); setQueueFilter(""); setPage(0); }}>Clear</button>
        <div style={{ flex: 1 }} />
        <button className="btn btn-ghost" onClick={fetchJobs}>↻ Refresh</button>
      </div>

      <Table columns={columns} data={jobs} isLoading={loading} onRowClick={setSelectedJob} />
      <Pagination page={page} total={total} limit={LIMIT} setPage={setPage} />

      {selectedJob && (
        <JobModal
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
          onRetry={async (id) => {
            await apiService.retryJob(id);
            fetchJobs();
            setSelectedJob(null);
          }}
        />
      )}
      {showAddDrawer && <AddJobDrawer onClose={() => setShowAddDrawer(false)} onAdded={fetchJobs} />}
    </div>
  );
};

export default JobsPage;
