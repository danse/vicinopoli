import { execSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

test("make backup produces a Postgres dump and a MinIO mirror", () => {
  execSync("make backup", {
    cwd: "..",
    stdio: "pipe",
  });

  const backupsDir = join(process.cwd(), "..", "backups");
  expect(existsSync(backupsDir)).toBe(true);
  const stamps = readdirSync(backupsDir).sort();
  expect(stamps.length).toBeGreaterThan(0);

  const latest = join(backupsDir, stamps[stamps.length - 1]);
  const dump = join(latest, "postgres.dump");
  expect(existsSync(dump)).toBe(true);
  expect(statSync(dump).size).toBeGreaterThan(1024);
  expect(existsSync(join(latest, "media"))).toBe(true);
});