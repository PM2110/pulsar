"use client";

import React, { useState } from "react";
import { useJobs } from "../hooks/useJobs";
import { DataTable, Pagination, SearchBar, Tooltip, Dropdown, Button, Chip, StatusBadge } from "../components/ui";
import type { Column, SortOrder } from "../components/ui";
import { PageHeader } from "../components/layout/PageHeader";
import { Section } from "../components/layout/Section";
import { PlusIcon, RefreshIcon, RetryIcon, CloseIcon } from "../components/icons";
import { JobModal } from "../components/jobs/JobModal";
import { AddJobDrawer } from "../components/jobs/AddJobDrawer";
import { apiService } from "../lib/api.service";
import { formatTime } from "../lib/utils";
import { Job } from "../types";

const QUEUES = ["notifications", "media", "default"];
const LIMIT = 10;

const STATUS_OPTIONS = [
  { label: "All Statuses", value: "" },
  { label: "Pending", value: "pending" },
  { label: "Processing", value: "processing" },
  { label: "Completed", value: "completed" },
  { label: "Failed", value: "failed" },
];

const QUEUE_OPTIONS = [
  { label: "All Queues", value: "" },
  ...QUEUES.map(q => ({ label: q, value: q })),
];

const JobsPage = () => {
  const {
    jobs, total, page, setPage, statusFilter, setStatusFilter,
    queueFilter, setQueueFilter, sort, setSort, loading, fetchJobs,
  } = useJobs(LIMIT);

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

  const handleSort = (key: string, order: SortOrder) => {
    setSort({ key, order });
    setPage(0);
  };

  const filteredJobs = search
    ? jobs.filter(j =>
      j.job_type.toLowerCase().includes(search.toLowerCase()) ||
      j.id.includes(search) ||
      j.queue_name.toLowerCase().includes(search.toLowerCase())
    )
    : jobs;

  const columns: Column<Job>[] = [
    {
      header: "ID", accessor: "id", sortable: true,
      render: (job) => (
        <Tooltip text={`Full ID: ${job.id}`}>
          <span className="mono" style={{ color: "var(--text-dim)" }}>#{job.id.slice(0, 8)}</span>
        </Tooltip>
      ),
    },
    {
      header: "Type", accessor: "job_type", sortKey: "job_type", sortable: true,
      render: (job) => <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{job.job_type}</span>,
    },
    {
      header: "Queue", accessor: "queue_name", sortKey: "queue_name", sortable: true,
      render: (job) => <Chip>{job.queue_name}</Chip>,
    },
    {
      header: "Status", accessor: "status", sortKey: "status", sortable: true,
      render: (job) => <StatusBadge status={job.status} />,
    },
    {
      header: "Priority", accessor: "priority", sortKey: "priority", sortable: true,
      render: (job) => (
        <Tooltip text={`Priority level: ${job.priority}/10`}>
          <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{job.priority}</span>
        </Tooltip>
      ),
    },
    {
      header: "Attempts", sortable: false,
      render: (job) => (
        <Tooltip text={`${job.attempts} of ${job.max_attempts} attempts used`}>
          <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
            {Array.from({ length: job.max_attempts }).map((_, i) => {
              const attempted = i < job.attempts;
              const current = i === job.attempts - 1;
              let bg = "var(--border)";
              if (attempted && current) {
                if (job.status === "completed") bg = "var(--success)";
                else if (job.status === "failed") bg = "var(--danger)";
                else if (job.status === "processing") bg = "var(--primary)";
                else bg = "var(--danger)";
              } else if (attempted) bg = "var(--danger)";
              return <div key={i} style={{ width: 7, height: 7, borderRadius: 2, background: bg, flexShrink: 0 }} />;
            })}
            <span style={{ fontSize: 10, color: "var(--text-faint)", marginLeft: 4 }}>{job.attempts}/{job.max_attempts}</span>
          </div>
        </Tooltip>
      ),
    },
    {
      header: "Mode", accessor: "failure_mode", sortKey: "failure_mode", sortable: true,
      render: (job) => (
        <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
          {job.failure_mode}
          {job.fail_probability != null && ` (${Math.round(job.fail_probability * 100)}%)`}
        </span>
      ),
    },
    {
      header: "Created", accessor: "created_at", sortKey: "created_at", sortable: true,
      render: (job) => <span style={{ fontSize: 11, color: "var(--text-dim)" }}>{formatTime(job.created_at)}</span>,
    },
    {
      header: "", sortable: false,
      render: (job) => (
        <div style={{ display: "flex", gap: 4 }}>
          {job.status === "failed" && (
            <Tooltip text="Retry this job">
              <Button variant="ghost" size="sm" onClick={(e) => retryJob(job.id, e)} icon={<RetryIcon size={11} />} />
            </Tooltip>
          )}
          <Tooltip text="Delete this job">
            <Button variant="ghost" size="sm" onClick={(e) => deleteJob(job.id, e)} icon={<CloseIcon size={10} />} />
          </Tooltip>
        </div>
      ),
    },
  ];

  return (
    <div className="pls-page">
      <PageHeader title="Jobs" subtitle={`${total} jobs · live refreshing via WebSocket`}>
        <Button variant="primary" onClick={() => setShowAddDrawer(true)} icon={<PlusIcon size={14} />}>Add Job</Button>
      </PageHeader>

      <Section>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ width: 260 }}>
            <SearchBar placeholder="Search by type, ID, or queue..." value={search} onChange={setSearch} debounceMs={250} />
          </div>
          <Dropdown options={STATUS_OPTIONS} value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(0); }} placeholder="All Statuses" style={{ width: 160 }} />
          <Dropdown options={QUEUE_OPTIONS} value={queueFilter} onChange={(v) => { setQueueFilter(v); setPage(0); }} placeholder="All Queues" style={{ width: 160 }} />
          <Button variant="ghost" onClick={() => { setStatusFilter(""); setQueueFilter(""); setSearch(""); setSort(undefined); setPage(0); }}>Clear</Button>
          <div style={{ flex: 1 }} />
          <Button variant="ghost" onClick={fetchJobs} icon={<RefreshIcon size={12} />}>Refresh</Button>
        </div>
      </Section>

      <DataTable columns={columns} data={filteredJobs} isLoading={loading} onRowClick={setSelectedJob} sort={sort} onSort={handleSort} />
      <Pagination page={page} total={total} limit={LIMIT} setPage={setPage} />

      {selectedJob && (
        <JobModal
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
          onRetry={async (id) => { await apiService.retryJob(id); fetchJobs(); setSelectedJob(null); }}
        />
      )}
      {showAddDrawer && <AddJobDrawer onClose={() => setShowAddDrawer(false)} onAdded={fetchJobs} />}
    </div>
  );
};

export default JobsPage;