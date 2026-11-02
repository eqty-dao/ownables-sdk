import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { test } from "node:test";
import { dirname, join } from "node:path";

test("resolves EQTY repositories and Docker Postgres from a linked worktree", () => {
  const result = spawnSync(process.execPath, ["bin/setup-e2e.mjs", "--validate-paths"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);
  const commonDir = execFileSync(
    "git",
    ["rev-parse", "--path-format=absolute", "--git-common-dir"],
    { cwd: process.cwd(), encoding: "utf8" }
  ).trim();
  const eqtyRoot = dirname(dirname(commonDir));
  assert.deepEqual(JSON.parse(result.stdout), {
    HUB_ROOT: join(eqtyRoot, "ownables-hub"),
    CONTRACTS_ROOT: join(eqtyRoot, "eqty-contracts"),
    DB_CONTAINER: process.env.HUB_DB_CONTAINER || "ownables-hub-postgres",
    databaseStrategy: "docker-exec",
  });
});

test("uses an explicit existing Hub worktree override", () => {
  const commonDir = execFileSync(
    "git",
    ["rev-parse", "--path-format=absolute", "--git-common-dir"],
    { cwd: process.cwd(), encoding: "utf8" }
  ).trim();
  const eqtyRoot = dirname(dirname(commonDir));
  const hubRoot = join(eqtyRoot, "ownables-hub.worktrees", "story10-quarantine-upload");
  const selectedHubRoot = existsSync(hubRoot) ? hubRoot : join(eqtyRoot, "ownables-hub");
  const result = spawnSync(process.execPath, ["bin/setup-e2e.mjs", "--validate-paths"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, E2E_HUB_ROOT: selectedHubRoot },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    HUB_ROOT: selectedHubRoot,
    CONTRACTS_ROOT: join(eqtyRoot, "eqty-contracts"),
    DB_CONTAINER: process.env.HUB_DB_CONTAINER || "ownables-hub-postgres",
    databaseStrategy: "docker-exec",
  });
});
