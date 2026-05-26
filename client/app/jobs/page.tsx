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
import { SearchInput, Tooltip } from "../components/ui";

const QUEUES = ["notifications", "media", "default"];
const LIMIT = 20;

const JobsPage = () => {
  const { jobs, total, page, setPage, statusFilter, setStatusFilter, queueFilter, setQueueFilter, loading, fetchJobs } = useJobs(LIMIT);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showAddDrawer, setShowAddDrawer] = useState(false);
  const [search, setSearch] = useState("");

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

  const filteredJobs = search
    ? jobs.filter(j => j.job_type.toLowerCase().includes(search.toLowerCase()) || j.id.includes(search) || j.queue_name.toLowerCase().includes(search.toLowerCase()))
    : jobs;

  const columns: Column<Job>[] = [
    {
      header: "ID",
      render: (job) => (
        <Tooltip text={`Full ID: ${job.id}`}>
          <span className="mono" style={{ color: "var(--text-dim)" }}>#{job.id.slice(0, 8)}</span>
        </Tooltip>
      ),
    },
    {
      header: "Type",
      render: (job) => <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{job.job_type}</span>,
    },
    {
      header: "Queue",
      render: (job) => <span className="chip" style={{ fontSize: 10 }}>{job.queue_name}</span>,
    },
    {
      header: "Status",
      render: (job) => <StatusBadge status={job.status} />,
    },
    {
      header: "Priority",
      render: (job) => (
        <Tooltip text={`Priority level: ${job.priority}/10`}>
          <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{job.priority}</span>
        </Tooltip>
      ),
    },
    {
      header: "Attempts",
      render: (job) => (
        <Tooltip text={`${job.attempts} of ${job.max_attempts} attempts used`}>
          <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
            {Array.from({ length: job.max_attempts }).map((_, i) => {
              const attempted = i < job.attempts;
              const current = i === job.attempts - 1;
              let bg = "var(--border)";
              if (attempted && current) {
                if (job.status === "completed") bg = "var(--green)";
                else if (job.status === "failed") bg = "var(--red)";
                else if (job.status === "processing") bg = "var(--accent)";
                else bg = "var(--red)";
              } else if (attempted) bg = "var(--red)";
              return <div key={i} style={{ width: 7, height: 7, borderRadius: 2, background: bg, flexShrink: 0 }} />;
            })}
            <span style={{ fontSize: 10, color: "var(--text-faint)", marginLeft: 4 }}>{job.attempts}/{job.max_attempts}</span>
          </div>
        </Tooltip>
      ),
    },
    {
      header: "Mode",
      render: (job) => (
        <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
          {job.failure_mode}
          {job.fail_probability != null && ` (${Math.round(job.fail_probability * 100)}%)`}
        </span>
      ),
    },
    {
      header: "Created",
      render: (job) => <span style={{ fontSize: 11, color: "var(--text-dim)" }}>{formatTime(job.created_at)}</span>,
    },
    {
      header: "",
      render: (job) => (
        <div style={{ display: "flex", gap: 4 }}>
          {job.status === "failed" && (
            <Tooltip text="Retry this job">
              <button className="btn btn-ghost" style={{ padding: "3px 9px", fontSize: 11 }} onClick={(e) => retryJob(job.id, e)}>↻</button>
            </Tooltip>
          )}
          <Tooltip text="Delete this job">
            <button className="btn btn-ghost" style={{ padding: "3px 9px", fontSize: 11 }} onClick={(e) => deleteJob(job.id, e)}>✕</button>
          </Tooltip>
        </div>
      ),
    },
  ];

  return (
    <div className="page-wrap">
      <div className="page-header">
        <div>
          <h1 className="page-title">Jobs</h1>
          <p className="page-sub">{total} jobs · live refreshing via WebSocket</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => setShowAddDrawer(true)}>+ Add Job</button>
        </div>
      </div>

      {/* Filters */}
      <div className="section">
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ width: 260 }}>
            <SearchInput placeholder="Search by type, ID, or queue..." value={search} onChange={setSearch} debounceMs={250} />
          </div>
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
          <button className="btn btn-ghost" onClick={() => { setStatusFilter(""); setQueueFilter(""); setSearch(""); setPage(0); }}>Clear</button>
          <div style={{ flex: 1 }} />
          <button className="btn btn-ghost" onClick={fetchJobs}>↻ Refresh</button>
        </div>
      </div>

      <Table columns={columns} data={filteredJobs} isLoading={loading} onRowClick={setSelectedJob} />
      <Pagination page={page} total={total} limit={LIMIT} setPage={setPage} />

      {selectedJob && (
        <JobModal job={selectedJob} onClose={() => setSelectedJob(null)} onRetry={async (id) => { await apiService.retryJob(id); fetchJobs(); setSelectedJob(null); }} />
      )}
      {showAddDrawer && <AddJobDrawer onClose={() => setShowAddDrawer(false)} onAdded={fetchJobs} />}
    </div>
  );
};

export default JobsPage;
