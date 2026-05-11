import type {
  RuntimeClaimRecoveryEvent,
  RuntimeClaimRecoveryRepository,
  RuntimeClaimSourceRepository,
  RuntimeClaimWindow,
  RuntimeClaimWindowRepository,
  RuntimeClaimWorkerRepository,
  RuntimeWorkerHeartbeat,
} from "@/modules/runtime-claim";
import type { ProviderReceipt } from "@/modules/provider-runtime";
import type { WorkerJob } from "@/modules/runtime";

export function createInMemoryRuntimeClaimSourceRepository(
  jobs: WorkerJob[],
  receipts: ProviderReceipt[] = [],
): RuntimeClaimSourceRepository {
  return {
    async listRuntimeJobs(input = {}) {
      return jobs
        .filter((job) => (input.statuses?.length ? input.statuses.includes(job.status) : true))
        .slice(0, input.limit ?? jobs.length);
    },
    async listProviderReceipts(input = {}) {
      return receipts.slice(0, input.limit ?? receipts.length);
    },
  };
}

export function createInMemoryRuntimeClaimWindowRepository(
  store: RuntimeClaimWindow[] = [],
): RuntimeClaimWindowRepository {
  return {
    newWindowId() {
      return `runtime-claim-window-${store.length + 1}`;
    },
    async findByWindowKey(windowKey) {
      return store.find((item) => item.windowKey === windowKey) ?? null;
    },
    async listRecentWindows(input = {}) {
      return [...store]
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
        .slice(0, input.limit ?? store.length);
    },
    async saveWindow(window) {
      const index = store.findIndex((item) => item.id === window.id);
      if (index >= 0) {
        store[index] = window;
      } else {
        store.push(window);
      }
      return window;
    },
  };
}

export function createInMemoryRuntimeClaimWorkerRepository(
  store: RuntimeWorkerHeartbeat[] = [],
): RuntimeClaimWorkerRepository {
  return {
    async getWorker(workerId) {
      return store.find((item) => item.workerId === workerId) ?? null;
    },
    async listWorkers() {
      return [...store].sort((left, right) => left.workerId.localeCompare(right.workerId));
    },
    async saveWorker(worker) {
      const index = store.findIndex((item) => item.workerId === worker.workerId);
      if (index >= 0) {
        store[index] = worker;
      } else {
        store.push(worker);
      }
      return worker;
    },
  };
}

export function createInMemoryRuntimeClaimRecoveryRepository(
  store: RuntimeClaimRecoveryEvent[] = [],
): RuntimeClaimRecoveryRepository {
  return {
    newRecoveryEventId() {
      return `runtime-claim-recovery-${store.length + 1}`;
    },
    async listRecentEvents(input = {}) {
      return [...store]
        .sort((left, right) => right.detectedAt.localeCompare(left.detectedAt))
        .slice(0, input.limit ?? store.length);
    },
    async saveEvent(event) {
      const index = store.findIndex((item) => item.id === event.id);
      if (index >= 0) {
        store[index] = event;
      } else {
        store.push(event);
      }
      return event;
    },
  };
}
