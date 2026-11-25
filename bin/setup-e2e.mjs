#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { EventEmitter } from "node:events";
import {
  appendFileSync,
  cpSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import {
  createPublicClient,
  createWalletClient,
  encodeDeployData,
  encodeFunctionData,
  http,
} from "viem";
import { mnemonicToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import examplePackages from "../src/config/example-packages.json" with { type: "json" };

const ROOT = process.cwd();
const RUN_ID = `${new Date().toISOString().replace(/[:.]/g, "-")}-${process.pid}`;
const ARTIFACT_DIR = join(ROOT, "artifacts", "e2e", RUN_ID);

function resolveEqtyRepositories(root = ROOT, hubRootOverride = process.env.E2E_HUB_ROOT) {
  const commonDir = runSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], {
    cwd: root,
  });
  const eqtyRoot = dirname(dirname(commonDir));
  const hubRoot = hubRootOverride?.trim()
    ? resolve(hubRootOverride)
    : join(eqtyRoot, "ownables-hub");
  const contractsRoot = join(eqtyRoot, "eqty-contracts");

  for (const [name, path] of [["ownables-hub", hubRoot], ["eqty-contracts", contractsRoot]]) {
    if (!existsSync(path)) {
      throw new Error(`Unable to resolve ${name} from Git common directory ${commonDir}: expected ${path}`);
    }
  }

  if (!existsSync(join(hubRoot, "package.json"))) {
    throw new Error(`The selected ownables-hub root is not a repository: ${hubRoot}`);
  }
  return { hubRoot, contractsRoot };
}

const { hubRoot: HUB_ROOT, contractsRoot: CONTRACTS_ROOT } = resolveEqtyRepositories();
const RPC_URL = "http://127.0.0.1:8545";
const APP_PORT = "3300";
const HUB_PORT = "3311";
const APP_URL = `http://127.0.0.1:${APP_PORT}`;
const HUB_URL = `http://127.0.0.1:${HUB_PORT}`;
const PUBLIC_OWNABLES_DIR = join(ROOT, "public", "ownables");
const DEFAULT_E2E_MNEMONIC =
  "test test test test test test test test test test test junk";
const DB_CONTAINER = process.env.HUB_DB_CONTAINER || "ownables-hub-postgres";
const DB_USER = process.env.HUB_DB_USER || "ownables";
const DB_PASSWORD = process.env.HUB_DB_PASSWORD || "ownables";
const DB_HOST = "127.0.0.1";
const DB_PORT = process.env.HUB_DB_PORT || "54329";
const DB_NAME = `ownables_hub_sdk_verify_${process.pid}`;
const DATABASE_URL = `postgres://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}`;
const HUB_STORAGE_DIR = join(tmpdir(), `ownables-hub-sdk-proof-storage-${process.pid}`);
const HUB_STORAGE_URL = `file://${HUB_STORAGE_DIR}`;
const RUNTIME_ENV_PATH = join(ROOT, ".e2e-runtime.json");
const EXTERNAL_WALLET = process.env.E2E_EXTERNAL_WALLET === "1";
const VITE_E2E = EXTERNAL_WALLET ? "0" : "1";

function hubIndexerRuntimeEnv({ anchorAddress, anchorStartBlock }) {
  return {
    DATABASE_URL,
    OWNABLES_STORAGE: HUB_STORAGE_URL,
    INDEXER_NETWORKS: "base-sepolia",
    TESTNET_CHAIN_ID: "84532",
    TESTNET_RPC_URL: RPC_URL,
    TESTNET_BASE_RPC_URL: RPC_URL,
    TESTNET_ANCHOR_CONTRACT_ADDR: anchorAddress,
    TESTNET_ANCHOR_START_BLOCK: String(anchorStartBlock),
  };
}

function lifecycleContract() {
  return {
    artifactDirectory: ARTIFACT_DIR,
    database: { container: DB_CONTAINER, user: DB_USER, name: DB_NAME },
    hubUrl: HUB_URL,
    rpcUrl: RPC_URL,
    viteE2E: VITE_E2E,
    cleanup: ["children", "runtime-file", "storage", "database"],
  };
}

function commandFailure(cmd, args, result) {
  const stdout = result.stdout?.trim();
  const stderr = result.stderr?.trim();
  return [
    `${cmd} ${args.join(" ")} failed with exit code ${result.status}`,
    stdout && `stdout:\n${stdout}`,
    stderr && `stderr:\n${stderr}`,
  ].filter(Boolean).join("\n");
}

function runSync(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });

  if (result.error) {
    throw new Error(`Failed to execute ${cmd}: ${result.error.message}`);
  }

  if (existsSync(ARTIFACT_DIR)) {
    const stdout = result.stdout?.trim();
    const stderr = result.stderr?.trim();
    appendLog(join(ARTIFACT_DIR, "setup.log"), [
      `$ ${cmd} ${args.join(" ")}`,
      stdout,
      stderr,
    ].filter(Boolean).join("\n"));
  }

  if (result.status !== 0) {
    const message = commandFailure(cmd, args, result);
    if (existsSync(ARTIFACT_DIR)) appendLog(join(ARTIFACT_DIR, "setup.log"), message);
    throw new Error(message);
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
    throw new Error(`${label} timed out: ${lastError.message}`);
  }
  throw new Error(`${label} timed out`);
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

function ensureExampleZips() {
  for (const { name: packageName } of examplePackages) {
    const name = packageName.replace(/^ownable-/, "");
    const zipPath = join(ROOT, "ownables", `${name}.zip`);
    if (!existsSync(zipPath)) {
      runSync("yarn", ["ownables:build", name], { cwd: ROOT });
    }
    if (!existsSync(zipPath)) {
      throw new Error(`Missing ${zipPath} after building the ${name} example`);
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
      CONTRACTS_ROOT,
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
  const recipient = mnemonicToAccount(mnemonic, { addressIndex: 1 });
  if (recipient.address !== "0x70997970C51812dc3A010C7d01b50e0d17dc79C8") {
    throw new Error(`Controlled recipient derivation mismatch: ${recipient.address}`);
  }
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
    throw new Error("EQTY deployment did not return a contract address");
  }

  const anchorDeployReceipt = await sendAndWait(walletClient, publicClient, {
    account,
    data: anchorBytecode,
  });
  const anchorAddress = anchorDeployReceipt.contractAddress;
  if (!anchorAddress) {
    throw new Error("Anchor deployment did not return a contract address");
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

  const headHex = await rpc("eth_blockNumber");
  const anchorStartBlock = Number.parseInt(headHex, 16);

  return { anchorAddress, eqtyTokenAddress, anchorStartBlock };
}

function appendLog(path, message) {
  appendFileSync(path, `${message}\n`);
}

function childExit(child) {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return new Promise((resolve) => child.once("exit", resolve));
}

class SetupResources {
  constructor({
    runtimePath = RUNTIME_ENV_PATH,
    storageDir = HUB_STORAGE_DIR,
    dropDatabase = dropVerificationDatabase,
    remove = rmSync,
    exists = existsSync,
  } = {}) {
    this.runtimePath = runtimePath;
    this.storageDir = storageDir;
    this.dropDatabase = dropDatabase;
    this.remove = remove;
    this.exists = exists;
    this.children = [];
    this.databaseCreated = false;
    this.storageCreated = false;
    this.runtimeWritten = false;
    this.cleaningUp = false;
    this.cleanupPromise = null;
    this.fatalError = null;
    this.rejectFatal = null;
    this.fatal = new Promise((_, reject) => {
      this.rejectFatal = reject;
    });
    this.fatal.catch(() => {});
  }

  reportFatal(error) {
    if (this.cleaningUp || this.fatalError) return;
    this.fatalError = error;
    this.rejectFatal(error);
  }

  spawn(name, cmd, args, options = {}) {
    const logPath = join(ARTIFACT_DIR, `${name}.log`);
    const stream = createWriteStream(logPath, { flags: "a" });
    const child = spawn(cmd, args, {
      stdio: ["ignore", "pipe", "pipe"],
      ...options,
    });
    const mirror = (output) => {
      output.on("data", (chunk) => {
        process.stdout.write(chunk);
        stream.write(chunk);
      });
    };
    mirror(child.stdout);
    child.stderr.on("data", (chunk) => {
      process.stderr.write(chunk);
      stream.write(chunk);
    });
    child.on("error", (error) => this.reportFatal(new Error(`${cmd} failed to start: ${error.message}`)));
    child.on("exit", (code, signal) => {
      stream.end();
      if (!this.cleaningUp && !signal && code !== 0) {
        this.reportFatal(new Error(`${cmd} ${args.join(" ")} exited with code ${code}; see ${logPath}`));
      }
    });
    this.children.push({ child, logPath, name });
    return child;
  }

  async cleanup() {
    if (this.cleanupPromise) return this.cleanupPromise;
    this.cleanupPromise = (async () => {
      this.cleaningUp = true;
      await Promise.all(this.children.map(async ({ child }) => {
        if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
        await childExit(child);
      }));
      if (this.runtimeWritten || this.exists(this.runtimePath)) this.remove(this.runtimePath, { force: true });
      if (this.storageCreated) this.remove(this.storageDir, { recursive: true, force: true });
      if (this.databaseCreated) this.dropDatabase();
    })();
    return this.cleanupPromise;
  }

  cleanupSynchronously() {
    for (const { child } of this.children) {
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
    }
  }
}

async function withSetupResources(resources, action) {
  try {
    return await action();
  } finally {
    await resources.cleanup();
  }
}

function fakeChild() {
  const child = new EventEmitter();
  child.exitCode = null;
  child.signalCode = null;
  child.killCalls = 0;
  child.kill = (signal) => {
    child.killCalls += 1;
    queueMicrotask(() => {
      child.signalCode = signal;
      child.emit("exit", null, signal);
    });
    return true;
  };
  return child;
}

async function verifyCleanupContract() {
  const removed = [];
  const dropped = [];
  const makeResources = (run) => new SetupResources({
    runtimePath: `/runtime/${run}.json`,
    storageDir: `/storage/${run}`,
    exists: () => false,
    remove: (path) => removed.push(path),
    dropDatabase: () => dropped.push(run),
  });

  const beforeDatabase = makeResources("before-database");
  await beforeDatabase.cleanup();
  if (removed.length !== 0 || dropped.length !== 0) {
    throw new Error("cleanup before database creation touched run resources");
  }

  const afterDatabase = makeResources("after-database");
  const child = fakeChild();
  afterDatabase.storageCreated = true;
  afterDatabase.databaseCreated = true;
  afterDatabase.runtimeWritten = true;
  afterDatabase.children.push({ child, name: "test", logPath: "/logs/test" });
  const childFailure = withSetupResources(afterDatabase, () => afterDatabase.fatal);
  afterDatabase.reportFatal(new Error("child exited"));
  await childFailure.catch(() => {});
  await afterDatabase.cleanup();
  if (child.killCalls !== 1) throw new Error(`expected one child cleanup, got ${child.killCalls}`);
  if (dropped.join(",") !== "after-database") throw new Error("cleanup dropped the wrong database");
  if (!removed.includes("/runtime/after-database.json") || !removed.includes("/storage/after-database")) {
    throw new Error("cleanup after database creation did not remove its runtime and storage");
  }

  const isolated = makeResources("other-run");
  await isolated.cleanup();
  if (dropped.length !== 1) throw new Error("an empty cleanup targeted another run database");

  const message = commandFailure("example", ["command"], {
    status: 17,
    stdout: "captured stdout",
    stderr: "captured stderr",
  });
  if (!message.includes("captured stdout") || !message.includes("captured stderr")) {
    throw new Error("command failure omitted captured output");
  }

  return {
    beforeDatabase: "clean",
    afterDatabase: "cleaned-once",
    childFailure: "cleaned-once",
    isolation: "preserved",
    commandOutput: "stdout-and-stderr",
  };
}

function ensureVerificationDatabase(onCreated) {
  runSync("docker", [
    "exec",
    DB_CONTAINER,
    "psql",
    "-v",
    "ON_ERROR_STOP=1",
    "-U",
    DB_USER,
    "-d",
    "postgres",
    "-c",
    `DROP DATABASE IF EXISTS \"${DB_NAME}\" WITH (FORCE)`,
  ]);
  runSync("docker", [
    "exec",
    DB_CONTAINER,
    "psql",
    "-v",
    "ON_ERROR_STOP=1",
    "-U",
    DB_USER,
    "-d",
    "postgres",
    "-c",
    `CREATE DATABASE \"${DB_NAME}\" OWNER \"${DB_USER}\"`,
  ]);
  onCreated();

  runSync("yarn", ["db:migrate:up"], {
    cwd: HUB_ROOT,
    env: {
      ...process.env,
      DATABASE_URL,
    },
  });
}

function dropVerificationDatabase() {
  const result = spawnSync(
    "docker",
    [
      "exec",
      DB_CONTAINER,
      "psql",
      "-v",
      "ON_ERROR_STOP=1",
      "-U",
      DB_USER,
      "-d",
      "postgres",
      "-c",
      `DROP DATABASE IF EXISTS \"${DB_NAME}\" WITH (FORCE)`,
    ],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }
  );

  if (result.error || result.status !== 0) {
    const detail = result.error?.message || result.stderr?.trim() || "unknown error";
    console.error(`Warning: failed to drop temporary verification database ${DB_NAME}: ${detail}`);
  }
}

async function main() {
  const resources = new SetupResources();
  mkdirSync(ARTIFACT_DIR, { recursive: true });
  for (const filename of ["setup.log", "anvil.log", "hub.log", "vite.log", "hub-restarts.log"]) {
    writeFileSync(join(ARTIFACT_DIR, filename), "");
  }
  appendLog(join(ARTIFACT_DIR, "setup.log"), `Starting E2E run ${RUN_ID}`);
  const stopForSignal = async (code) => {
    await resources.cleanup();
    process.exit(code);
  };
  process.once("SIGINT", () => void stopForSignal(130));
  process.once("SIGTERM", () => void stopForSignal(143));
  process.once("exit", () => resources.cleanupSynchronously());

  return withSetupResources(resources, async () => {
    ensureExampleZips();
    syncOwnableZips();
    mkdirSync(HUB_STORAGE_DIR, { recursive: true });
    resources.storageCreated = true;
    runSync("yarn", ["db:start"], { cwd: HUB_ROOT });
    ensureVerificationDatabase(() => {
      resources.databaseCreated = true;
    });

  resources.spawn("anvil", "anvil", [
    "--chain-id",
    "84532",
    "--host",
    "127.0.0.1",
    "--port",
    "8545",
  ]);
  await waitFor(async () => (await rpc("eth_chainId")) === "0x14a34", "anvil RPC");
  const { anchorAddress, eqtyTokenAddress, anchorStartBlock } = await bootstrapContracts();
  const indexerRuntimeEnv = hubIndexerRuntimeEnv({ anchorAddress, anchorStartBlock });
  const hubRuntimeEnv = {
    ...indexerRuntimeEnv,
    NODE_ENV: process.env.NODE_ENV || "development",
    OWNABLES_STORAGE: HUB_STORAGE_URL,
    CORS_ORIGINS: APP_URL,
    PORT: HUB_PORT,
    PUBLIC_BASE_URL: HUB_URL,
    LOCAL_DEV_RECIPIENT_DISCOVERY_ENABLED: "true",
    SIGNER_MNEMONIC: DEFAULT_E2E_MNEMONIC,
  };

  const hubEnv = {
    ...process.env,
    ...hubRuntimeEnv,
  };

  // Build once and own the actual Hub process directly. The development watcher
  // spawns a grandchild that can outlive this setup process and keep port 3311
  // bound to a dropped database, producing a false-empty discovery response.
  runSync("yarn", ["build"], { cwd: HUB_ROOT, env: hubEnv });
  const hub = resources.spawn("hub", "node", ["--preserve-symlinks", "--env-file-if-exists=.env", "dist/main.js"], {
    cwd: HUB_ROOT,
    env: hubEnv,
  });
  if (!hub.pid) {
    throw new Error("ownables-hub runtime did not expose a process id");
  }

  await waitFor(async () => {
    const response = await fetch(`${HUB_URL}/health`);
    return response.ok;
  }, "ownables-hub runtime", 60_000);

  const appEnv = {
    ...process.env,
    LETSRUNIT_BASE_URL: APP_URL,
    VITE_E2E,
    VITE_E2E_RPC_URL: RPC_URL,
    VITE_BASE_SEPOLIA_RPC_URL: RPC_URL,
    VITE_BASE_SEPOLIA_ANCHOR_ADDRESS: anchorAddress,
    VITE_BASE_SEPOLIA_EQTY_TOKEN_ADDRESS: eqtyTokenAddress,
    VITE_HUB: HUB_URL,
    VITE_OWNABLE_EXAMPLES_URL: "/ownables",
    DATABASE_URL,
    PORT: HUB_PORT,
    PUBLIC_BASE_URL: HUB_URL,
    SIGNER_MNEMONIC: DEFAULT_E2E_MNEMONIC,
    INDEXER_NETWORKS: "base-sepolia",
    TESTNET_CHAIN_ID: "84532",
    TESTNET_RPC_URL: RPC_URL,
    TESTNET_BASE_RPC_URL: RPC_URL,
    TESTNET_ANCHOR_CONTRACT_ADDR: anchorAddress,
    TESTNET_ANCHOR_START_BLOCK: String(anchorStartBlock),
  };

  resources.spawn(
    "vite",
    "yarn",
    ["start", "--host", "127.0.0.1", "--port", APP_PORT, "--strictPort"],
    {
      cwd: ROOT,
      env: appEnv,
    }
  );
  await waitFor(async () => {
    const response = await fetch(APP_URL);
    return response.ok;
  }, "Vite dev server");

  writeFileSync(
    RUNTIME_ENV_PATH,
    `${JSON.stringify(
      {
        LETSRUNIT_BASE_URL: APP_URL,
        VITE_E2E,
        VITE_E2E_RPC_URL: RPC_URL,
        VITE_BASE_SEPOLIA_RPC_URL: RPC_URL,
        VITE_BASE_SEPOLIA_ANCHOR_ADDRESS: anchorAddress,
        VITE_BASE_SEPOLIA_EQTY_TOKEN_ADDRESS: eqtyTokenAddress,
        VITE_HUB: HUB_URL,
        VITE_OWNABLE_EXAMPLES_URL: "/ownables",
        E2E_HUB_INDEXER_ENV_JSON: JSON.stringify(indexerRuntimeEnv),
        E2E_HUB_RUNTIME_ENV_JSON: JSON.stringify(hubRuntimeEnv),
        E2E_HUB_ROOT: HUB_ROOT,
        E2E_HUB_PROCESS_ID: String(hub.pid),
        E2E_ARTIFACT_DIR: ARTIFACT_DIR,
        E2E_DATABASE_CONTAINER: DB_CONTAINER,
        E2E_DATABASE_USER: DB_USER,
        E2E_DATABASE_NAME: DB_NAME,
        E2E_HUB_URL: HUB_URL,
        E2E_RPC_URL: RPC_URL,
      },
      null,
      2
    )}\n`
  );
  resources.runtimeWritten = true;

  console.log(`E2E stack ready: app=${APP_URL} hub=${HUB_URL} rpc=${RPC_URL} artifacts=${ARTIFACT_DIR}`);
  await Promise.race([new Promise(() => {}), resources.fatal]);
  });
}

if (process.argv.includes("--verify-cleanup")) {
  console.log(JSON.stringify(await verifyCleanupContract()));
} else if (process.argv.includes("--validate-lifecycle")) {
  console.log(JSON.stringify(lifecycleContract()));
} else if (process.argv.includes("--validate-paths")) {
  const indexerRuntimeEnv = hubIndexerRuntimeEnv({ anchorAddress: "0xanchor", anchorStartBlock: 0 });
  console.log(JSON.stringify({
    HUB_ROOT,
    CONTRACTS_ROOT,
    DB_CONTAINER,
    databaseStrategy: "docker-exec",
    indexerStorage: indexerRuntimeEnv.OWNABLES_STORAGE,
    hubStorage: HUB_STORAGE_URL,
  }));
} else {
  try {
    await main();
  } catch (error) {
    const message = error instanceof Error ? error.stack || error.message : String(error);
    if (existsSync(ARTIFACT_DIR)) appendLog(join(ARTIFACT_DIR, "setup.log"), message);
    console.error(message);
    process.exitCode = 1;
  }
}
