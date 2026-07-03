#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = process.cwd();
const RPC_URL = "http://127.0.0.1:8545";
const APP_PORT = "3300";
const APP_URL = `http://127.0.0.1:${APP_PORT}`;
const ANCHOR_ADDRESS = "0x7607af0cea78815c71bbea90110b2c218879354b";
const REQUIRED_ZIPS = ["potion.zip", "block-stack.zip"];
const PUBLIC_OWNABLES_DIR = join(ROOT, "public", "ownables");
let cleaningUp = false;

function fail(message) {
  console.error(message);
  process.exit(1);
}

function runSync(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });

  if (result.error) {
    fail(`Failed to execute ${cmd}: ${result.error.message}`);
  }

  if (result.status !== 0) {
    const stderr = result.stderr?.trim();
    fail(stderr ? `${cmd} ${args.join(" ")} failed:\n${stderr}` : `${cmd} ${args.join(" ")} failed`);
  }

  return result.stdout.trim();
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

async function rpc(method, params = []) {
  const response = await fetch(RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params,
    }),
  });
  const body = await response.json();
  if (body.error) {
    throw new Error(body.error.message || JSON.stringify(body.error));
  }
  return body.result;
}

function ensureProofInputs() {
  for (const zipName of REQUIRED_ZIPS) {
    const zipPath = join(ROOT, "ownables", zipName);
    if (!existsSync(zipPath)) {
      fail(`Missing ${zipPath}. Build the accepted ownables before running the public-events proof.`);
    }
  }
}

function syncOwnableZips() {
  mkdirSync(PUBLIC_OWNABLES_DIR, { recursive: true });
  rmSync(PUBLIC_OWNABLES_DIR, { recursive: true, force: true });
  mkdirSync(PUBLIC_OWNABLES_DIR, { recursive: true });

  for (const entry of readdirSync(join(ROOT, "ownables"))) {
    if (entry.endsWith(".zip")) {
      cpSync(join(ROOT, "ownables", entry), join(PUBLIC_OWNABLES_DIR, entry));
    }
  }
}

function resolveAnchorRuntimeBytecode() {
  const forgeDir = join(tmpdir(), `ownables-sdk-anchor-${process.pid}`);
  const outDir = join(forgeDir, "out");
  const cacheDir = join(forgeDir, "cache");
  mkdirSync(outDir, { recursive: true });
  mkdirSync(cacheDir, { recursive: true });

  try {
    return runSync("forge", [
      "inspect",
      "--root",
      "/home/arnold/Projects/eqty/eqty-contracts",
      "--out",
      outDir,
      "--cache-path",
      cacheDir,
      "src/Anchor.sol:Anchor",
      "deployedBytecode",
    ]);
  } finally {
    rmSync(forgeDir, { recursive: true, force: true });
  }
}

async function bootstrapAnchor() {
  const runtimeBytecode = resolveAnchorRuntimeBytecode();
  await rpc("anvil_setCode", [ANCHOR_ADDRESS, runtimeBytecode]);
}

function spawnProcess(cmd, args, options = {}) {
  const child = spawn(cmd, args, {
    stdio: "inherit",
    ...options,
  });

  child.on("exit", (code, signal) => {
    if (cleaningUp) {
      return;
    }
    if (signal) {
      return;
    }
    if (code && code !== 0) {
      fail(`${cmd} ${args.join(" ")} exited with code ${code}`);
    }
  });

  return child;
}

async function main() {
  ensureProofInputs();
  syncOwnableZips();

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

  const anvil = spawnProcess("anvil", [
    "--chain-id",
    "84532",
    "--host",
    "127.0.0.1",
    "--port",
    "8545",
  ]);
  children.push(anvil);

  await waitFor(async () => (await rpc("eth_chainId")) === "0x14a34", "anvil RPC");
  await bootstrapAnchor();

  const env = {
    ...process.env,
    LETSRUNIT_BASE_URL: APP_URL,
    VITE_E2E: "1",
    VITE_E2E_RPC_URL: RPC_URL,
    VITE_BASE_SEPOLIA_RPC_URL: RPC_URL,
    VITE_OWNABLE_EXAMPLES_URL: "/ownables",
  };

  const app = spawnProcess("yarn", ["start", "--host", "127.0.0.1", "--port", APP_PORT, "--strictPort"], {
    cwd: ROOT,
    env,
  });
  children.push(app);

  await waitFor(async () => {
    const response = await fetch(APP_URL);
    return response.ok;
  }, "Vite dev server");

  const result = spawnSync("yarn", ["cucumber-js", "features/public-events.feature"], {
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
