import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const SERVICES_DIR = path.resolve(process.cwd(), "src/server/services");
const CANONICAL_WRITER = "work-order-service.ts";

test("work-order-service is the only authoritative workOrders repository writer", async () => {
  const files = await readdir(SERVICES_DIR);
  const offenders: string[] = [];

  for (const file of files) {
    if (!file.endsWith(".ts") || file === CANONICAL_WRITER) {
      continue;
    }

    const source = await readFile(path.join(SERVICES_DIR, file), "utf8");
    if (/(?:this\.repositories|repositories)\.workOrders\.(save|create)\(/.test(source)) {
      offenders.push(file);
    }
  }

  assert.deepEqual(offenders, []);
});
