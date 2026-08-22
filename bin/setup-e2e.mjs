#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
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
const HUB_ROOT = join(ROOT, "..", "ownables-hub");
const CONTRACTS_ROOT = join(ROOT, "..", "eqty-contracts");
const RPC_URL = "http://127.0.0.1:8545";
const APP_PORT = "3300";
const HUB_PORT = "3311";
const APP_URL = `http://127.0.0.1:${APP_PORT}`;
const HUB_URL = `http://127.0.0.1:${HUB_PORT}`;
const REQUIRED_ZIPS = ["potion.zip", "block-stack.zip"];
const PUBLIC_OWNABLES_DIR = join(ROOT, "public", "ownables");
const DEFAULT_E2E_MNEMONIC =
  "test test test test test test test test test test test junk";
const DB_USER = "ownables";
const DB_PASSWORD = "ownables";
const DB_HOST = "127.0.0.1";
const DB_PORT = "54329";
const DB_NAME = `ownables_hub_sdk_verify_${process.pid}`;
const DATABASE_URL = `postgres://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}`;
const HUB_STORAGE_DIR = join(tmpdir(), `ownables-hub-sdk-proof-storage-${process.pid}`);
const RUNTIME_ENV_PATH = join(ROOT, ".e2e-runtime.json");
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
    fail(
      stderr
        ? `${cmd} ${args.join(" ")} failed:\n${stderr}`
        : `${cmd} ${args.join(" ")} failed`
    );
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
      fail(
        `Missing ${zipPath}. Build the accepted ownables before running the public-events proof.`
      );
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

  const headHex = await rpc("eth_blockNumber");
  const anchorStartBlock = Number.parseInt(headHex, 16);

  return { anchorAddress, eqtyTokenAddress, anchorStartBlock };
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

function ensureVerificationDatabase() {
  const env = {
    ...process.env,
    PGPASSWORD: DB_PASSWORD,
  };

  spawnSync(
    "dropdb",
    ["--if-exists", "--host", DB_HOST, "--port", DB_PORT, "--username", DB_USER, DB_NAME],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env,
    }
  );

  runSync(
    "createdb",
    ["--host", DB_HOST, "--port", DB_PORT, "--username", DB_USER, DB_NAME],
    { env }
  );

  runSync("yarn", ["db:migrate:up"], {
    cwd: HUB_ROOT,
    env: {
      ...process.env,
      DATABASE_URL,
    },
  });
}

function dropVerificationDatabase() {
  const env = {
    ...process.env,
    PGPASSWORD: DB_PASSWORD,
  };

  const result = spawnSync(
    "dropdb",
    ["--if-exists", "--host", DB_HOST, "--port", DB_PORT, "--username", DB_USER, DB_NAME],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env,
    }
  );

  if (result.error || result.status !== 0) {
    const detail = result.error?.message || result.stderr?.trim() || "unknown error";
    console.error(`Warning: failed to drop temporary verification database ${DB_NAME}: ${detail}`);
  }
}

async function main() {
  ensureProofInputs();
  syncOwnableZips();
  mkdirSync(HUB_STORAGE_DIR, { recursive: true });
  runSync("yarn", ["db:start"], { cwd: HUB_ROOT });
  ensureVerificationDatabase();

  const children = [];
  const cleanup = async () => {
    cleaningUp = true;
    for (const child of children) {
      if (!child.killed) {
        child.kill("SIGTERM");
      }
    }
    rmSync(RUNTIME_ENV_PATH, { force: true });
    dropVerificationDatabase();
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
  const { anchorAddress, eqtyTokenAddress, anchorStartBlock } = await bootstrapContracts();

  const hubEnv = {
    ...process.env,
    DATABASE_URL,
    OWNABLES_STORAGE: `file://${HUB_STORAGE_DIR}`,
    CORS_ORIGINS: APP_URL,
    PORT: HUB_PORT,
    PUBLIC_BASE_URL: HUB_URL,
    LOCAL_DEV_RECIPIENT_DISCOVERY_ENABLED: "true",
    SIGNER_MNEMONIC: DEFAULT_E2E_MNEMONIC,
    HUB_NETWORK_PROFILE: "testnet",
    TESTNET_CHAIN_ID: "84532",
    TESTNET_RPC_URL: RPC_URL,
    TESTNET_BASE_RPC_URL: RPC_URL,
    TESTNET_ANCHOR_CONTRACT_ADDR: anchorAddress,
    TESTNET_ANCHOR_START_BLOCK: String(anchorStartBlock),
    MAINNET_CHAIN_ID: "84532",
    MAINNET_RPC_URL: RPC_URL,
    MAINNET_ANCHOR_CONTRACT_ADDR: anchorAddress,
    MAINNET_ANCHOR_START_BLOCK: "999999999",
  };

  // Build once and own the actual Hub process directly. The development watcher
  // spawns a grandchild that can outlive this setup process and keep port 3311
  // bound to a dropped database, producing a false-empty discovery response.
  runSync("yarn", ["build"], { cwd: HUB_ROOT, env: hubEnv });
  const hub = spawnProcess("node", ["--preserve-symlinks", "--env-file=.env", "dist/main.js"], {
    cwd: HUB_ROOT,
    env: hubEnv,
  });
  children.push(hub);

  await waitFor(async () => {
    const response = await fetch(`${HUB_URL}/health`);
    return response.ok;
  }, "ownables-hub runtime", 60_000);

  const appEnv = {
    ...process.env,
    LETSRUNIT_BASE_URL: APP_URL,
    VITE_E2E: "1",
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
    HUB_NETWORK_PROFILE: "testnet",
    TESTNET_CHAIN_ID: "84532",
    TESTNET_RPC_URL: RPC_URL,
    TESTNET_BASE_RPC_URL: RPC_URL,
    TESTNET_ANCHOR_CONTRACT_ADDR: anchorAddress,
    TESTNET_ANCHOR_START_BLOCK: String(anchorStartBlock),
    MAINNET_CHAIN_ID: "84532",
    MAINNET_RPC_URL: RPC_URL,
    MAINNET_ANCHOR_CONTRACT_ADDR: anchorAddress,
    MAINNET_ANCHOR_START_BLOCK: "999999999",
  };

  const app = spawnProcess(
    "yarn",
    ["start", "--host", "127.0.0.1", "--port", APP_PORT, "--strictPort"],
    {
      cwd: ROOT,
      env: appEnv,
    }
  );
  children.push(app);

  await waitFor(async () => {
    const response = await fetch(APP_URL);
    return response.ok;
  }, "Vite dev server");

  writeFileSync(
    RUNTIME_ENV_PATH,
    `${JSON.stringify(
      {
        LETSRUNIT_BASE_URL: APP_URL,
        VITE_E2E: "1",
        VITE_E2E_RPC_URL: RPC_URL,
        VITE_BASE_SEPOLIA_RPC_URL: RPC_URL,
        VITE_BASE_SEPOLIA_ANCHOR_ADDRESS: anchorAddress,
        VITE_BASE_SEPOLIA_EQTY_TOKEN_ADDRESS: eqtyTokenAddress,
        VITE_HUB: HUB_URL,
        VITE_OWNABLE_EXAMPLES_URL: "/ownables",
      },
      null,
      2
    )}\n`
  );

  console.log(`E2E stack ready: app=${APP_URL} hub=${HUB_URL} rpc=${RPC_URL}`);
  await new Promise(() => {});
}

await main();
