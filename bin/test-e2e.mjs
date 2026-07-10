#!/usr/bin/env node

import { readdirSync } from "node:fs";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";

const ROOT = process.cwd();
const APP_PORT = process.env.OWNABLES_SDK_E2E_PORT || "3300";
const APP_URL = `http://127.0.0.1:${APP_PORT}`;
const FEATURE_DIR = join(ROOT, "features");
const EXCLUDED_FEATURES = new Set(["public-events.feature"]);
let cleaningUp = false;

function fail(message) {
  console.error(message);
  process.exit(1);
}

async function waitFor(check, label, timeoutMs = 30_000) {
  const start = Date.now();
  let lastError = null;

  while (Date.now() - start < timeoutMs) {
    try {
      const result = await check();
      if (result) return result;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  if (lastError instanceof Error) {
    fail(`${label} timed out: ${lastError.message}`);
  }
  fail(`${label} timed out`);
}

function spawnProcess(cmd, args, options = {}) {
  const child = spawn(cmd, args, {
    stdio: "inherit",
    ...options,
  });

  child.on("exit", (code, signal) => {
    if (cleaningUp || signal) return;
    if (code && code !== 0) {
      fail(`${cmd} ${args.join(" ")} exited with code ${code}`);
    }
  });

  return child;
}

async function main() {
  const featureArgs = readdirSync(FEATURE_DIR)
    .filter((entry) => entry.endsWith(".feature") && !EXCLUDED_FEATURES.has(entry))
    .sort()
    .map((entry) => join("features", entry));

  if (featureArgs.length === 0) {
    fail("No default E2E feature files were found.");
  }

  const env = {
    ...process.env,
    LETSRUNIT_BASE_URL: APP_URL,
    VITE_E2E: "1",
    VITE_OWNABLE_EXAMPLES_URL: process.env.VITE_OWNABLE_EXAMPLES_URL || "/ownables",
  };

  const children = [];
  const cleanup = () => {
    cleaningUp = true;
    for (const child of children) {
      if (!child.killed) {
        child.kill("SIGTERM");
      }
    }
  };

  process.on("exit", cleanup);
  process.on("SIGINT", () => {
    cleanup();
    process.exit(130);
  });
  process.on("SIGTERM", () => {
    cleanup();
    process.exit(143);
  });

  const app = spawnProcess(
    "yarn",
    ["start", "--host", "127.0.0.1", "--port", APP_PORT, "--strictPort"],
    {
      cwd: ROOT,
      env,
    }
  );
  children.push(app);

  await waitFor(async () => {
    const response = await fetch(APP_URL);
    return response.ok;
  }, "Vite dev server");

  const result = spawnSync("yarn", ["cucumber-js", ...featureArgs], {
    cwd: ROOT,
    env,
    stdio: "inherit",
  });

  cleanup();

  if (result.error) {
    fail(`Failed to execute cucumber-js: ${result.error.message}`);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

await main();
