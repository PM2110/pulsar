import { useState, useCallback, useEffect } from "react";
import { WorkerInfo } from "../types";
import { apiService, socket } from "../lib/api.service";

export const useWorkers = () => {
  const [workers, setWorkers] = useState<WorkerInfo[]>([]);
  const [autoScaleConfig, setAutoScaleConfig] = useState<Record<string, any>>({});

  const fetchWorkers = useCallback(async () => {
    try {
      const data = await apiService.getWorkers();
      setWorkers(data.workers || []);
      const scaleData = await apiService.getAutoscalerConfig();
      setAutoScaleConfig(scaleData.config || {});
    } catch {}
  }, []);

  useEffect(() => { fetchWorkers(); }, [fetchWorkers]);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    const handleUpdate = () => {
      clearTimeout(timeout);
      timeout = setTimeout(fetchWorkers, 500);
    };
    
    socket.on("job_update", handleUpdate);
    socket.on("stats_update", handleUpdate);
    return () => {
      clearTimeout(timeout);
      socket.off("job_update", handleUpdate);
      socket.off("stats_update", handleUpdate);
    };
  }, [fetchWorkers]);

  return { workers, fetchWorkers, autoScaleConfig, setAutoScaleConfig };
};
