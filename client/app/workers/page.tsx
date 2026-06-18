"use client";

import { useEffect, useState, useCallback } from "react";
import { apiService, socket } from "../lib/api.service";
import { Accordion, SearchBar, Slider, Button } from "../components/ui";
import { PageHeader } from "../components/layout/PageHeader";
import { Section } from "../components/layout/Section";
import { WorkerCard } from "../components/workers/WorkerCard";
import { FleetOverview } from "../components/workers/FleetOverview";
import { DeployPanel } from "../components/workers/DeployPanel";
import { ScalingConfig } from "../components/workers/ScalingConfig";
import { BoltIcon } from "../components/icons";
import { WorkerInfo } from "../types";

const QUEUES = ["notifications", "media", "default"];

export default function WorkersPage() {
  const [workers, setWorkers] = useState<WorkerInfo[]>([]);
  const [search, setSearch] = useState("");
  const [seedForm, setSeedForm] = useState({ count: 5, queue_name: "", failure_mode: "" });
  const [seeding, setSeeding] = useState(false);
  const [asc, setAsc] = useState<Record<string, any>>({});
  const [now, setNow] = useState(Date.now());

  const fetchWorkers = useCallback(async () => {
    try {
      const d = await apiService.getWorkers();
      setWorkers(d.workers || []);
      const s = await apiService.getAutoscalerConfig();
      setAsc(s.config || {});
    } catch { }
  }, []);

  useEffect(() => {
    fetchWorkers();
    const c = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(c);
  }, [fetchWorkers]);

  useEffect(() => {
    const handleUpdate = () => fetchWorkers();
    socket.on("stats_update", handleUpdate);
    socket.on("worker_update", handleUpdate);
    return () => {
      socket.off("stats_update", handleUpdate);
      socket.off("worker_update", handleUpdate);
    };
  }, [fetchWorkers]);

  const active = workers.filter(w => w.status !== "stopped" && (now - new Date(w.last_activity).getTime() < 30000));
  const inactive = workers.filter(w => w.status === "stopped" || (now - new Date(w.last_activity).getTime() >= 30000));

  const filtered = (list: WorkerInfo[]) => search
    ? list.filter(w => w.worker_id.toLowerCase().includes(search.toLowerCase()) || w.queue_name.toLowerCase().includes(search.toLowerCase()))
    : list;

  return (
    <div className="pls-page">
      <PageHeader
        title="Worker Fleet"
        subtitle={`${active.length} active · ${inactive.length} inactive · WebSocket connected`}
      >
        <div style={{ width: 240 }}>
          <SearchBar placeholder="Search workers..." value={search} onChange={setSearch} debounceMs={200} />
        </div>
        <Button variant="ghost" onClick={fetchWorkers}>Refresh</Button>
      </PageHeader>

      {/* Fleet Stats */}
      <Section label="Fleet Overview">
        <FleetOverview
          activeCount={active.length}
          processedCount={workers.reduce((a, w) => a + w.jobs_processed, 0)}
          failedCount={workers.reduce((a, w) => a + w.jobs_failed, 0)}
        />
      </Section>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24 }}>
        <div>
          {/* Active nodes */}
          <Section label="Active Nodes">
            <Accordion
              title="Active Workers"
              badge={<span className="pls-acc-badge">{filtered(active).length}</span>}
              defaultOpen
            >
              {filtered(active).length > 0 ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 16 }}>
                  {filtered(active).map(w => (
                    <WorkerCard
                      key={w.worker_id}
                      w={w}
                      now={now}
                      onRefresh={fetchWorkers}
                      onCrash={id => apiService.crashWorker(id)}
                      onStop={(id, o) => apiService.stopWorker(id, o)}
                    />
                  ))}
                </div>
              ) : (
                <div style={{
                  padding: 50, textAlign: "center", border: "2px dashed var(--border)",
                  borderRadius: "var(--radius)", color: "var(--text-faint)", fontSize: 13
                }}>
                  {search ? "No workers match your search" : "No active workers. Deploy from the panel →"}
                </div>
              )}
            </Accordion>
          </Section>

          {/* Inactive nodes */}
          {filtered(inactive).length > 0 && (
            <Section label="Inactive Nodes">
              <Accordion
                title="Inactive Workers"
                badge={<span className="pls-acc-badge">{filtered(inactive).length}</span>}
              >
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 16 }}>
                  {filtered(inactive).map(w => (
                    <WorkerCard
                      key={w.worker_id}
                      w={w}
                      now={now}
                      onRefresh={fetchWorkers}
                      onCrash={id => apiService.crashWorker(id)}
                      onStop={(id, o) => apiService.stopWorker(id, o)}
                    />
                  ))}
                </div>
              </Accordion>
            </Section>
          )}
        </div>

        {/* Control Panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <DeployPanel queues={QUEUES} onDeploySuccess={fetchWorkers} />

          <Accordion title="Load Injector" icon={<BoltIcon />}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Slider
                label="Job Count"
                value={seedForm.count}
                onChange={v => setSeedForm(f => ({ ...f, count: v }))}
                min={1}
                max={50}
              />
              <Button
                variant="primary"
                onClick={async () => {
                  setSeeding(true);
                  await apiService.seedJobs(seedForm);
                  setSeeding(false);
                }}
                disabled={seeding}
                style={{ width: "100%" }}
              >
                {seeding ? "Injecting..." : "⚡ Inject Load"}
              </Button>
            </div>
          </Accordion>

          <ScalingConfig queues={QUEUES} asc={asc} />
        </div>
      </div>
    </div>
  );
}