import assert from "node:assert/strict";
import test from "node:test";

import { createRuntimeSchedulerService } from "@/modules/scheduler/server/runtime-scheduler-service.ts";
import { createInMemorySchedulerRepositories } from "@/modules/scheduler/server/scheduler-task-repository.ts";
import { createRuntimeHarness } from "./support/runtime-harness.ts";

test("runtime scheduler seeds canonical tasks and duplicate ticks do not enqueue duplicate maintenance jobs", async () => {
  const harness = createRuntimeHarness();
  const schedulerRepositories = createInMemorySchedulerRepositories();
  const scheduler = createRuntimeSchedulerService(schedulerRepositories, harness.runtime);

  const first = await scheduler.tick({
    organizationId: "org-1",
    workerId: "scheduler-worker-1",
    now: "2026-05-07T10:00:00.000Z",
  });
  assert.equal(first.ok, true);
  assert.equal(first.value.dueTaskCount, 4);
  assert.equal(first.value.enqueuedCount, 4);
  assert.equal(harness.jobs.length, 4);

  const second = await scheduler.tick({
    organizationId: "org-1",
    workerId: "scheduler-worker-2",
    now: "2026-05-07T10:00:00.000Z",
  });
  assert.equal(second.ok, true);
  assert.equal(second.value.dueTaskCount, 0);
  assert.equal(harness.jobs.length, 4);

  const tasks = await schedulerRepositories.tasks.listByOrganizationId({
    organizationId: "org-1",
  });
  assert.equal(tasks.length, 4);
  assert.equal(tasks.every((task) => task.lastRuntimeJobId !== null), true);
  assert.deepEqual(
    harness.jobs.map((job) => job.type).sort(),
    [
      "operations.projection.refresh",
      "provider.reconciliation.sweep",
      "runtime.health.refresh",
      "sla.scan.overdue",
    ],
  );
});
