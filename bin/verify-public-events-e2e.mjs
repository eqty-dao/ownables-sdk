#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createPublicClient,
  createWalletClient,
  encodeDeployData,
  encodeFunctionData,
  http,
} from "viem";
import { mnemonicToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

const ROOT = process.cwd();
const RPC_URL = "http://127.0.0.1:8545";
const APP_PORT = "3300";
const HUB_PORT = "3311";
const APP_URL = `http://127.0.0.1:${APP_PORT}`;
const HUB_URL = `http://127.0.0.1:${HUB_PORT}`;
const HUB_CONTROL_URL = `${HUB_URL}/__control/`;
const REQUIRED_ZIPS = ["potion.zip", "block-stack.zip"];
const PUBLIC_OWNABLES_DIR = join(ROOT, "public", "ownables");
const DEFAULT_E2E_MNEMONIC =
  "test test test test test test test test test test test junk";
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

function inspectContractBytecode(contractPath, field) {
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
      contractPath,
      field,
    ]);
  } finally {
    rmSync(forgeDir, { recursive: true, force: true });
  }
}

function createDeploymentClients() {
  const mnemonic = process.env.VITE_E2E_MNEMONIC?.trim() || DEFAULT_E2E_MNEMONIC;
  const account = mnemonicToAccount(mnemonic);
  const walletClient = createWalletClient({
    account,
    chain: {
      ...baseSepolia,
      rpcUrls: {
        ...baseSepolia.rpcUrls,
        default: { http: [RPC_URL] },
      },
    },
    transport: http(RPC_URL),
  });
  const publicClient = createPublicClient({
    chain: {
      ...baseSepolia,
      rpcUrls: {
        ...baseSepolia.rpcUrls,
        default: { http: [RPC_URL] },
      },
    },
    transport: http(RPC_URL),
  });

  return { account, walletClient, publicClient };
}

async function sendAndWait(walletClient, publicClient, request) {
  const hash = await walletClient.sendTransaction(request);
  return publicClient.waitForTransactionReceipt({ hash });
}

async function bootstrapContracts() {
  const { account, walletClient, publicClient } = createDeploymentClients();
  const eqtyBytecode = inspectContractBytecode("src/EQTY.sol:EQTY", "bytecode");
  const anchorBytecode = inspectContractBytecode("src/Anchor.sol:Anchor", "bytecode");
  const deployAbi = [
    {
      type: "constructor",
      inputs: [
        { name: "_bridgeWallet", type: "address" },
        { name: "_mintDeadline", type: "uint256" },
      ],
    },
  ];

  const eqtyDeployReceipt = await sendAndWait(walletClient, publicClient, {
    account,
    data: encodeDeployData({
      abi: deployAbi,
      bytecode: eqtyBytecode,
      args: [account.address, BigInt(Math.floor(Date.now() / 1000) + 86400)],
    }),
  });
  const eqtyTokenAddress = eqtyDeployReceipt.contractAddress;
  if (!eqtyTokenAddress) {
    fail("EQTY deployment did not return a contract address");
  }

  const anchorDeployReceipt = await sendAndWait(walletClient, publicClient, {
    account,
    data: anchorBytecode,
  });
  const anchorAddress = anchorDeployReceipt.contractAddress;
  if (!anchorAddress) {
    fail("Anchor deployment did not return a contract address");
  }

  await sendAndWait(walletClient, publicClient, {
    account,
    to: anchorAddress,
    data: encodeFunctionData({
      abi: [
        {
          type: "function",
          name: "setEqtyToken",
          stateMutability: "nonpayable",
          inputs: [{ name: "newEqtyToken", type: "address" }],
          outputs: [],
        },
      ],
      functionName: "setEqtyToken",
      args: [eqtyTokenAddress],
    }),
  });

  await sendAndWait(walletClient, publicClient, {
    account,
    to: anchorAddress,
    data: encodeFunctionData({
      abi: [
        {
          type: "function",
          name: "setEqtyFee",
          stateMutability: "nonpayable",
          inputs: [{ name: "newFee", type: "uint256" }],
          outputs: [],
        },
      ],
      functionName: "setEqtyFee",
      args: [0n],
    }),
  });

  return { anchorAddress, eqtyTokenAddress };
}

function spawnProcess(cmd, args, options = {}) {
  const child = spawn(cmd, args, {
    stdio: "inherit",
    ...options,
  });

  child.on("exit", (code, signal) => {
    if (cleaningUp || signal) {
      return;
    }
    if (code && code !== 0) {
      fail(`${cmd} ${args.join(" ")} exited with code ${code}`);
    }
  });

  return child;
}

async function runProcess(cmd, args, options = {}) {
  return await new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: "inherit",
      ...options,
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      resolve({ code, signal });
    });
  });
}

function createHubVerifierServer() {
  const state = {
    availableSnapshots: new Map(),
    publicEventSnapshots: new Map(),
    availableSubscribers: new Set(),
    publicEventSubscribers: new Set(),
    requests: {
      availableSnapshots: [],
      availableStreams: [],
      publicEventSnapshots: [],
      publicEventStreams: [],
    },
  };

  const dedupeEventKey = (event) => `${event.transactionHash}:${event.logIndex}`;

  const appendPublicEvent = (ownableId, publicEvent) => {
    const current = state.publicEventSnapshots.get(ownableId) ?? [];
    const next = [...current.filter((event) => dedupeEventKey(event) !== dedupeEventKey(publicEvent)), publicEvent]
      .sort((left, right) => {
        if (left.blockNumber !== right.blockNumber) {
          return left.blockNumber - right.blockNumber;
        }
        if (left.transactionIndex !== right.transactionIndex) {
          return left.transactionIndex - right.transactionIndex;
        }
        return left.logIndex - right.logIndex;
      });
    state.publicEventSnapshots.set(ownableId, next);
  };

  const writeJson = (res, status, body) => {
    res.writeHead(status, {
      "access-control-allow-origin": "*",
      "content-type": "application/json",
    });
    res.end(JSON.stringify(body));
  };

  const writeSse = (res, eventName, payload) => {
    res.write(`event: ${eventName}\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  const readJson = async (req) => {
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    if (chunks.length === 0) {
      return {};
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  };

  const reset = () => {
    state.availableSnapshots.clear();
    state.publicEventSnapshots.clear();
    state.requests.availableSnapshots = [];
    state.requests.availableStreams = [];
    state.requests.publicEventSnapshots = [];
    state.requests.publicEventStreams = [];
  };

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", HUB_URL);

    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET,POST,OPTIONS",
        "access-control-allow-headers": "content-type",
      });
      res.end();
      return;
    }

    if (req.method === "GET" && url.pathname === "/health") {
      writeJson(res, 200, { ok: true });
      return;
    }

    if (req.method === "GET" && url.pathname === "/ownables/available") {
      const owner = url.searchParams.get("owner") ?? "";
      state.requests.availableSnapshots.push({ owner });
      writeJson(res, 200, {
        owner,
        entries: state.availableSnapshots.get(owner) ?? [],
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/ownables/available/stream") {
      const owner = url.searchParams.get("owner") ?? "";
      state.requests.availableStreams.push({
        owner,
        queryEntries: [...url.searchParams.entries()],
        queryKeys: [...url.searchParams.keys()],
      });
      res.writeHead(200, {
        "access-control-allow-origin": "*",
        "cache-control": "no-cache",
        connection: "keep-alive",
        "content-type": "text/event-stream",
      });
      res.write("\n");
      const subscriber = { owner, res };
      state.availableSubscribers.add(subscriber);
      req.on("close", () => {
        state.availableSubscribers.delete(subscriber);
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/ownables/public-events/stream") {
      const ids = url.searchParams.getAll("id").sort();
      const from = Number(url.searchParams.get("from") ?? "0");
      const requestRecord = {
        ids,
        from,
        queryEntries: [...url.searchParams.entries()],
        queryKeys: [...url.searchParams.keys()],
      };
      state.requests.publicEventStreams.push(requestRecord);

      res.writeHead(200, {
        "access-control-allow-origin": "*",
        "cache-control": "no-cache",
        connection: "keep-alive",
        "content-type": "text/event-stream",
      });
      res.write("\n");

      for (const ownableId of ids) {
        const events = state.publicEventSnapshots.get(ownableId) ?? [];
        for (const publicEvent of events.filter((event) => Number(event.blockNumber) >= from)) {
          writeSse(res, "public-event", {
            ownableId,
            publicEvent,
          });
        }
      }

      const subscriber = { from, ids: new Set(ids), res };
      state.publicEventSubscribers.add(subscriber);
      req.on("close", () => {
        state.publicEventSubscribers.delete(subscriber);
      });
      return;
    }

    const publicEventsSnapshotMatch = url.pathname.match(/^\/ownables\/([^/]+)\/public-events$/);
    if (req.method === "GET" && publicEventsSnapshotMatch) {
      const ownableId = decodeURIComponent(publicEventsSnapshotMatch[1]);
      state.requests.publicEventSnapshots.push({ ownableId });
      writeJson(res, 200, {
        ownableId,
        publicEvents: state.publicEventSnapshots.get(ownableId) ?? [],
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/__control/reset") {
      reset();
      writeJson(res, 200, { ok: true });
      return;
    }

    if (req.method === "GET" && url.pathname === "/__control/requests") {
      writeJson(res, 200, state.requests);
      return;
    }

    if (req.method === "POST" && url.pathname === "/__control/discovery-snapshot") {
      const body = await readJson(req);
      state.availableSnapshots.set(body.owner, body.entries ?? []);
      writeJson(res, 200, { ok: true });
      return;
    }

    if (req.method === "POST" && url.pathname === "/__control/discovery-event") {
      const body = await readJson(req);
      const nextEntries = [
        ...(state.availableSnapshots.get(body.owner) ?? []).filter((entry) => entry.id !== body.entry.id),
        body.entry,
      ];
      state.availableSnapshots.set(body.owner, nextEntries);
      for (const subscriber of state.availableSubscribers) {
        if (subscriber.owner === body.owner) {
          writeSse(subscriber.res, "available-ownable", {
            owner: body.owner,
            entry: body.entry,
          });
        }
      }
      writeJson(res, 200, { ok: true });
      return;
    }

    if (req.method === "POST" && url.pathname === "/__control/public-events-snapshot") {
      const body = await readJson(req);
      state.publicEventSnapshots.set(body.ownableId, body.publicEvents ?? []);
      writeJson(res, 200, { ok: true });
      return;
    }

    if (req.method === "POST" && url.pathname === "/__control/public-event") {
      const body = await readJson(req);
      appendPublicEvent(body.ownableId, body.publicEvent);
      for (const subscriber of state.publicEventSubscribers) {
        if (
          subscriber.ids.has(body.ownableId) &&
          Number(body.publicEvent.blockNumber) >= subscriber.from
        ) {
          writeSse(subscriber.res, "public-event", {
            ownableId: body.ownableId,
            publicEvent: body.publicEvent,
          });
        }
      }
      writeJson(res, 200, { ok: true });
      return;
    }

    writeJson(res, 404, { error: "Not found" });
  });

  return {
    async start() {
      await new Promise((resolve, reject) => {
        server.listen(HUB_PORT, "127.0.0.1", resolve);
        server.on("error", reject);
      });
    },
    async stop() {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}

async function main() {
  ensureProofInputs();
  syncOwnableZips();

  const hubServer = createHubVerifierServer();
  await hubServer.start();

  const children = [];
  const cleanup = async () => {
    cleaningUp = true;
    for (const child of children) {
      if (!child.killed) {
        child.kill("SIGTERM");
      }
    }
    await hubServer.stop().catch(() => {});
  };

  process.on("exit", () => {
    void cleanup();
  });
  process.on("SIGINT", () => {
    void cleanup().finally(() => process.exit(130));
  });
  process.on("SIGTERM", () => {
    void cleanup().finally(() => process.exit(143));
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
  const { anchorAddress, eqtyTokenAddress } = await bootstrapContracts();

  const env = {
    ...process.env,
    LETSRUNIT_BASE_URL: APP_URL,
    PUBLIC_EVENTS_VERIFY_HUB_CONTROL_URL: HUB_CONTROL_URL,
    VITE_E2E: "1",
    VITE_E2E_RPC_URL: RPC_URL,
    VITE_BASE_SEPOLIA_RPC_URL: RPC_URL,
    VITE_BASE_SEPOLIA_ANCHOR_ADDRESS: anchorAddress,
    VITE_BASE_SEPOLIA_EQTY_TOKEN_ADDRESS: eqtyTokenAddress,
    VITE_HUB: HUB_URL,
    VITE_OWNABLE_EXAMPLES_URL: "/ownables",
  };

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

  const result = await runProcess(
    "yarn",
    ["cucumber-js", "features/public-events.feature"],
    {
      cwd: ROOT,
      env,
    }
  );

  await cleanup();

  if (result.signal) {
    fail(`yarn cucumber-js was terminated by signal ${result.signal}`);
  }
  if (result.code !== 0) {
    process.exit(result.code ?? 1);
  }
}

await main();
