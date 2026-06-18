import { useState, useCallback, useEffect } from "react";
import { apiService, socket } from "../lib/api.service";
import { Job } from "../types";
import { SortState } from "../components/ui/Table";

export const useJobs = (limit: number = 10) => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [queueFilter, setQueueFilter] = useState("");
  const [sort, setSort] = useState<SortState | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiService.getJobs({
        limit,
        offset: page * limit,
        status: statusFilter || undefined,
        queue_name: queueFilter || undefined,
        sort_by: sort?.key || undefined,
        sort_order: sort?.order || undefined,
      });
      setJobs(data.jobs || []);
      setTotal(data.meta?.count || 0);
    } catch { }
    setLoading(false);
  }, [page, statusFilter, queueFilter, sort, limit]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    const handleJobUpdate = () => {
      clearTimeout(timeout);
      timeout = setTimeout(fetchJobs, 200);
    };
    socket.on("job_update", handleJobUpdate);
    return () => {
      clearTimeout(timeout);
      socket.off("job_update", handleJobUpdate);
    };
  }, [fetchJobs]);

  return {
    jobs, total, page, setPage, statusFilter, setStatusFilter,
    queueFilter, setQueueFilter, sort, setSort, loading, fetchJobs,
  };
};
