#!/usr/bin/env node

import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OWNABLES_JS_ROOT = resolve(ROOT, "../ownables-js");
const LOCAL_PACKAGES = [
  "packages/core/dist/services/Ownable.service.js",
  "packages/adapter-viem/dist/services/EQTY.service.js",
  "packages/platform-browser/dist/platform-browser/src/index.js",
];
const LOCAL_WORKSPACES = [
  "@ownables/core",
  "@ownables/adapter-viem",
  "@ownables/platform-browser",
];

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    env: process.env,
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (!existsSync(OWNABLES_JS_ROOT)) {
  process.exit(0);
}

for (const workspace of LOCAL_WORKSPACES) {
  run("yarn", ["workspace", workspace, "build"], OWNABLES_JS_ROOT);
}

for (const relativePath of LOCAL_PACKAGES) {
  if (!existsSync(resolve(OWNABLES_JS_ROOT, relativePath))) {
    run("yarn", ["install"], ROOT);
    process.exit(0);
  }
}

run("yarn", ["install"], ROOT);
