#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
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
const APP_URL = `http://127.0.0.1:${APP_PORT}`;
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
  const { anchorAddress, eqtyTokenAddress } = await bootstrapContracts();

  const env = {
    ...process.env,
    LETSRUNIT_BASE_URL: APP_URL,
    VITE_E2E: "1",
    VITE_E2E_RPC_URL: RPC_URL,
    VITE_BASE_SEPOLIA_RPC_URL: RPC_URL,
    VITE_BASE_SEPOLIA_ANCHOR_ADDRESS: anchorAddress,
    VITE_BASE_SEPOLIA_EQTY_TOKEN_ADDRESS: eqtyTokenAddress,
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
