import { Given, Then, When } from '@letsrunit/bdd';
import { EventChain } from 'eqty-core';
import JSZip from 'jszip';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createPublicClient, formatUnits, http, parseUnits } from 'viem';
import { mnemonicToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { clearBrowserWalletState } from './utils/browser-state.ts';
import { expectOwnableWidgetReady } from './utils/ownable-widget.ts';

const DEFAULT_E2E_MNEMONIC =
  'test test test test test test test test test test test junk';
const E2E_CHAIN_ID = 84532; // Base Sepolia
const E2E_RPC_URL = process.env.VITE_E2E_RPC_URL || 'http://127.0.0.1:8545';
const ANCHOR_ADDRESS = (process.env.VITE_BASE_SEPOLIA_ANCHOR_ADDRESS ||
  '0x7607af0cea78815c71bbea90110b2c218879354b') as `0x${string}`;
const EQTY_TOKEN_ADDRESS = (process.env.VITE_BASE_SEPOLIA_EQTY_TOKEN_ADDRESS ||
  '0x24159513a74ca294f5367764557438d318eb7ffe') as `0x${string}`;
const E2E_ADDRESS = resolveE2EAddress();
const IDB_PREFIX = `ownables:${E2E_CHAIN_ID}:`;
const IDB_NAME = `ownables:${E2E_CHAIN_ID}:${E2E_ADDRESS}`;
const PROJECT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..'
);
const HUB_ORIGIN = process.env.VITE_HUB?.trim().replace(/\/$/, '') ?? '';
const HUB_PROJECT_ROOT = path.resolve(PROJECT_ROOT, '..', 'ownables-hub');
const OWNABLE_ZIP_DIR = path.join(PROJECT_ROOT, 'ownables');

interface TrackedPublicEventRecord {
  replayKey: string;
  status: 'pending' | 'confirmed';
  sources: string[];
  event: {
    eventType: string;
    transactionHash: string;
    logIndex: number;
    blockNumber: number;
    [key: string]: unknown;
  };
}

interface StoredOwnableUploadInput {
  packageCid: string;
  chainJson: unknown;
}

interface HubIndexerRunResult {
  stdout: string;
  stderr: string;
}

interface HubUploadAttemptResult {
  uploaded: boolean;
  attempt: number;
  uploadStatus: number;
  uploadMessage: string;
  verificationStatus: number;
  verificationMessage: string;
  indexerStdout: string;
  indexerStderr: string;
}

let exampleZipPathByPackageCidPromise: Promise<Map<string, string>> | null = null;

function resolveE2EAddress() {
  const mnemonic = process.env.VITE_E2E_MNEMONIC?.trim() || DEFAULT_E2E_MNEMONIC;
  const indexRaw = process.env.VITE_E2E_ACCOUNT_INDEX;
  const addressIndex = Number.isFinite(Number(indexRaw)) ? Number(indexRaw) : 0;
  return mnemonicToAccount(mnemonic, { addressIndex }).address.toLowerCase();
}

function debugString(value: unknown) {
  return JSON.stringify(value, (_, currentValue) =>
    typeof currentValue === 'bigint' ? currentValue.toString() : currentValue
  );
}

async function readResponseMessage(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return summarizeMessage(text) || `status ${response.status}`;
  } catch {
    return `status ${response.status}`;
  }
}

function summarizeMessage(text: string, maxLength = 400): string {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLength - 3)}...`;
}

function summarizeProcessOutput(text: string, maxLines = 6): string {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    return '';
  }
  return summarizeMessage(lines.slice(-maxLines).join(' | '), 500);
}

const PACKAGES = [
  {
    title: 'Antenna',
    name: 'ownable-antenna',
    description: 'Add-on for Robot',
    cid: 'bafybeig7pd32tqm564ksqsliicv7u3jru5i6kzq7ct6g6e3difyu3grk34',
    keywords: [],
    isNotLocal: false,
    isDynamic: true,
    hasMetadata: true,
    hasWidgetState: true,
    hasAttachments: false,
    isClosable: false,
    isConsumable: true,
    isConsumer: false,
    isTransferable: true,
    versions: [{ date: '2025-10-06T14:32:57.294Z', cid: 'bafybeig7pd32tqm564ksqsliicv7u3jru5i6kzq7ct6g6e3difyu3grk34' }],
  },
  {
    title: 'Car',
    name: 'ownable-car',
    description: 'Ride for HODLers',
    cid: 'bafybeigljdubk7pbkhecvswsekvdyms7dhetm7xa7blubugjx4ciqii274',
    keywords: [],
    isNotLocal: false,
    isDynamic: false,
    hasMetadata: false,
    hasWidgetState: false,
    hasAttachments: false,
    isClosable: false,
    isConsumable: false,
    isConsumer: false,
    isTransferable: false,
    versions: [{ date: '2025-10-06T14:33:02.677Z', cid: 'bafybeigljdubk7pbkhecvswsekvdyms7dhetm7xa7blubugjx4ciqii274' }],
  },
  {
    title: 'Robot',
    name: 'ownable-robot',
    description: 'An adorable robot companion',
    cid: 'bafybeihskccwosjdz7ze3px6gw7p55hchrt6hqjsvrn2pyjzsr6spe5l64',
    keywords: [],
    isNotLocal: false,
    isDynamic: true,
    hasMetadata: true,
    hasWidgetState: true,
    hasAttachments: false,
    isClosable: false,
    isConsumable: false,
    isConsumer: true,
    isTransferable: true,
    versions: [{ date: '2025-11-10T15:59:29.816Z', cid: 'bafybeihskccwosjdz7ze3px6gw7p55hchrt6hqjsvrn2pyjzsr6spe5l64' }],
  },
];

function makeOwnableSeeds() {
  return PACKAGES.map((pkg) => {
    const chain = EventChain.create(E2E_ADDRESS, E2E_CHAIN_ID);
    return {
      chainId: chain.id,
      packageCid: pkg.cid,
      chainJson: chain.toJSON(),
      state: chain.state.hex,
      latestHash: chain.latestHash.hex,
    };
  });
}

function createE2EPublicClient() {
  return createPublicClient({
    chain: {
      ...baseSepolia,
      rpcUrls: {
        ...baseSepolia.rpcUrls,
        default: { http: [E2E_RPC_URL] },
      },
    },
    transport: http(E2E_RPC_URL),
  });
}

async function waitFor<T>(
  getValue: () => Promise<T | null>,
  validate: (value: T) => boolean,
  label: string,
  timeoutMs = 10_000
): Promise<T> {
  const started = Date.now();
  let lastValue: T | null = null;

  while (Date.now() - started < timeoutMs) {
    const value = await getValue();
    if (value !== null) {
      lastValue = value;
      if (validate(value)) {
        return value;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error(
    `${label} timed out${lastValue === null ? '' : `: ${debugString(lastValue)}`}`
  );
}

async function ensureAnchoringEnabled(page: any) {
  const menuButton = page.getByRole('button', { name: 'menu' });
  await menuButton.click();

  const settingsHeading = page.getByRole('heading', { name: 'Settings' });
  await settingsHeading.waitFor();

  const anchoringSwitch = page.getByRole('switch', { name: 'Anchor events' });
  await anchoringSwitch.waitFor();

  if (!(await anchoringSwitch.isChecked())) {
    await anchoringSwitch.click();
    await waitFor(
      async () => ((await anchoringSwitch.isChecked()) ? true : null),
      (enabled) => enabled,
      'Anchor events switch should become enabled'
    );
  }

  await page.getByRole('button', { name: 'Close settings' }).click();
}

async function hubControl(pathname: string, init?: RequestInit) {
  throw new Error(`Hub control is unavailable on the real-Hub proof lane for ${pathname}`);
}

function ensureHubRequestRecorder(world: any) {
  const page = world.page;
  if (!page || !HUB_ORIGIN) {
    return;
  }

  if (world.__hubRequestHandler) {
    return;
  }

  world.__hubRequests = {
    publicEventSnapshots: [],
    publicEventStreams: [],
  };

  const handler = (request: { url(): string }) => {
    try {
      const url = new URL(request.url());
      if (!url.href.startsWith(HUB_ORIGIN)) {
        return;
      }

      const publicEventsSnapshotMatch = url.pathname.match(/^\/ownables\/([^/]+)\/public-events$/);
      if (publicEventsSnapshotMatch) {
        world.__hubRequests.publicEventSnapshots.push({
          ownableId: decodeURIComponent(publicEventsSnapshotMatch[1]),
        });
        return;
      }

      if (url.pathname === '/ownables/public-events/stream') {
        world.__hubRequests.publicEventStreams.push({
          ids: url.searchParams.getAll('id').sort(),
          from: Number(url.searchParams.get('from') ?? '0'),
          queryEntries: [...url.searchParams.entries()],
          queryKeys: [...url.searchParams.keys()],
        });
      }
    } catch {
      // Ignore malformed or non-HTTP requests.
    }
  };

  world.__hubRequestHandler = handler;
  page.on('request', handler);
}

function runHubIndexer(): HubIndexerRunResult {
  const result = spawnSync('yarn', ['indexer:run'], {
    cwd: HUB_PROJECT_ROOT,
    env: process.env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const stderr = result.stderr?.trim();
    throw new Error(
      stderr
        ? `yarn indexer:run failed:\n${stderr}`
        : `yarn indexer:run failed with code ${String(result.status)}`
    );
  }

  return {
    stdout: summarizeProcessOutput(result.stdout ?? ''),
    stderr: summarizeProcessOutput(result.stderr ?? ''),
  };
}

async function resolveOwnablesDatabaseName(page: any): Promise<string> {
  return page.evaluate(async ({ preferredName, prefix }) => {
    if (typeof indexedDB.databases !== 'function') {
      return preferredName;
    }

    const databases = await indexedDB.databases();
    const names = databases
      .map((database) => database?.name)
      .filter((name): name is string => Boolean(name));

    return (
      names.find((name) => name === preferredName) ??
      names.find((name) => name.startsWith(prefix)) ??
      preferredName
    );
  }, { preferredName: IDB_NAME, prefix: IDB_PREFIX });
}

async function listImportedOwnableIds(page: any): Promise<string[]> {
  const idbName = await resolveOwnablesDatabaseName(page);
  return page.evaluate(async ({ idbName }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(idbName);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    const ids = Array.from(db.objectStoreNames)
      .filter((storeName) => storeName.startsWith('ownable:'))
      .filter((storeName) => !storeName.endsWith('.snapshots'))
      .filter((storeName) => !storeName.endsWith('.state'))
      .filter((storeName) => !storeName.endsWith('.public-event-replays'))
      .map((storeName) => storeName.slice('ownable:'.length))
      .sort();

    db.close();
    return ids;
  }, { idbName });
}

async function storedOwnableUploadInput(
  page: any,
  ownableId: string
): Promise<StoredOwnableUploadInput> {
  const idbName = await resolveOwnablesDatabaseName(page);
  return page.evaluate(async ({ idbName, ownableId }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(idbName);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    const storeName = `ownable:${ownableId}`;
    if (!db.objectStoreNames.contains(storeName)) {
      db.close();
      throw new Error(`Missing IndexedDB store for ownable ${ownableId}`);
    }

    const packageCid = await new Promise<string | undefined>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const request = tx.objectStore(storeName).get('package');
      request.onsuccess = () => resolve(request.result as string | undefined);
      request.onerror = () => reject(request.error);
    });

    const chainJson = await new Promise<unknown>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const request = tx.objectStore(storeName).get('chain');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    db.close();

    if (!packageCid) {
      throw new Error(`Missing package metadata for ownable ${ownableId}`);
    }
    if (!chainJson) {
      throw new Error(`Missing chain data for ownable ${ownableId}`);
    }

    return {
      packageCid,
      chainJson,
    };
  }, { idbName, ownableId });
}

function readPackageCidFromScriptOutput(output: string, zipName: string): string {
  const lines = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const cid = lines.at(-1)?.split(/\s+/)[0];
  if (!cid) {
    throw new Error(`Unable to resolve package CID for ${zipName}`);
  }
  return cid;
}

async function exampleZipPathByPackageCid(): Promise<Map<string, string>> {
  if (!exampleZipPathByPackageCidPromise) {
    exampleZipPathByPackageCidPromise = (async () => {
      const zipNames = (await readdir(OWNABLE_ZIP_DIR))
        .filter((name) => name.endsWith('.zip') && !name.startsWith('.'))
        .sort();
      const result = new Map<string, string>();

      for (const zipName of zipNames) {
        const packageName = zipName.slice(0, -4);
        const output = spawnSync('node', ['bin/package-cid.mjs', packageName], {
          cwd: PROJECT_ROOT,
          env: process.env,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        if (output.error) {
          throw output.error;
        }

        if (output.status !== 0) {
          const stderr = output.stderr?.trim();
          throw new Error(
            stderr
              ? `bin/package-cid.mjs ${packageName} failed:\n${stderr}`
              : `bin/package-cid.mjs ${packageName} failed with code ${String(output.status)}`
          );
        }

        const packageCid = readPackageCidFromScriptOutput(output.stdout, zipName);
        result.set(packageCid, path.join(OWNABLE_ZIP_DIR, zipName));
      }

      return result;
    })();
  }

  return exampleZipPathByPackageCidPromise;
}

async function originalOwnableArchive(
  page: any,
  ownableId: string
): Promise<{ content: Uint8Array; packageCid: string }> {
  const { packageCid, chainJson } = await storedOwnableUploadInput(page, ownableId);
  const zipPaths = await exampleZipPathByPackageCid();
  const zipPath = zipPaths.get(packageCid);

  if (!zipPath) {
    const availableCids = [...zipPaths.keys()].sort().join(', ');
    throw new Error(
      `No original example zip matches package CID ${packageCid} for ownable ${ownableId}. Available example CIDs: ${availableCids}`
    );
  }

  const archive = await JSZip.loadAsync(await readFile(zipPath));
  archive.remove('eventChain.json');
  archive.file('chain.json', JSON.stringify(chainJson));

  return {
    content: await archive.generateAsync({ type: 'uint8array' }),
    packageCid,
  };
}

async function ensureOwnableUploadedToHub(page: any, ownableId: string): Promise<void> {
  if (!HUB_ORIGIN) {
    throw new Error('VITE_HUB is required for the real-Hub proof lane');
  }

  const verificationResponse = await fetch(
    `${HUB_ORIGIN}/ownables/${encodeURIComponent(ownableId)}/verification`
  );
  if (verificationResponse.ok) {
    return;
  }

  const verificationMessage = await readResponseMessage(verificationResponse);
  if (
    verificationResponse.status !== 400 ||
    !verificationMessage.toLowerCase().includes('not available on this hub')
  ) {
    throw new Error(
      `Expected unknown-ownable verification response before upload, received ${verificationResponse.status}: ${verificationMessage}`
    );
  }

  const { content, packageCid } = await originalOwnableArchive(page, ownableId);
  let attempt = 0;

  await waitFor(
    async (): Promise<HubUploadAttemptResult> => {
      attempt += 1;
      const form = new FormData();
      form.append(
        'file',
        new File([content], `${packageCid}.zip`, { type: 'application/zip' })
      );

      const indexer = runHubIndexer();
      const uploadResponse = await fetch(`${HUB_ORIGIN}/ownables/upload`, {
        method: 'POST',
        body: form,
      });
      const uploadMessage = await readResponseMessage(uploadResponse);
      const verificationResponse = await fetch(
        `${HUB_ORIGIN}/ownables/${encodeURIComponent(ownableId)}/verification`
      );
      const verificationMessage = await readResponseMessage(verificationResponse);

      if (uploadResponse.ok) {
        return {
          uploaded: true,
          attempt,
          uploadStatus: uploadResponse.status,
          uploadMessage,
          verificationStatus: verificationResponse.status,
          verificationMessage,
          indexerStdout: indexer.stdout,
          indexerStderr: indexer.stderr,
        };
      }

      if (
        uploadResponse.status === 400 &&
        uploadMessage.includes('UNVERIFIED_OWNABLE')
      ) {
        return {
          uploaded: false,
          attempt,
          uploadStatus: uploadResponse.status,
          uploadMessage,
          verificationStatus: verificationResponse.status,
          verificationMessage,
          indexerStdout: indexer.stdout,
          indexerStderr: indexer.stderr,
        };
      }

      throw new Error(`Hub upload failed with status ${uploadResponse.status}: ${uploadMessage}`);
    },
    (result) => result.uploaded,
    `Hub upload for ownable ${ownableId}`,
    80_000
  );
}

async function currentOwnableId(page: any): Promise<string> {
  const activeOwnableId = await page
    .locator('iframe[aria-label="Ownable widget"]')
    .getAttribute('id');
  if (activeOwnableId) {
    return activeOwnableId;
  }

  const ids = await listImportedOwnableIds(page);
  if (ids.length === 0) {
    throw new Error('No imported ownables were found in IndexedDB');
  }

  return ids[ids.length - 1]!;
}

async function trackedPublicEvents(page: any, ownableId: string): Promise<TrackedPublicEventRecord[]> {
  const idbName = await resolveOwnablesDatabaseName(page);
  return page.evaluate(async ({ idbName, ownableId }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(idbName);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    const storeName = `ownable:${ownableId}.public-event-replays`;
    if (!db.objectStoreNames.contains(storeName)) {
      db.close();
      return [];
    }

    const records = await new Promise<any[]>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const request = tx.objectStore(storeName).getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    db.close();
    return records;
  }, { idbName, ownableId });
}

Given('my wallet is empty', async function () {
  await clearBrowserWalletState(this.page);
});

Given('the Hub transport verifier backend is reset', async function () {
  ensureHubRequestRecorder(this);
  (this as any).__hubRequests = {
    publicEventSnapshots: [],
    publicEventStreams: [],
  };
  (this as any).rememberedOwnableIds = {};
});

Given('there are example Ownables', async function () {
  const seeds = makeOwnableSeeds();

  await this.page.goto('/');

  await this.page.evaluate(async ({ idbName, packages, seeds }) => {
    localStorage.setItem('packages', JSON.stringify(packages));

    const currentVersion = await new Promise<number>((resolve) => {
      const req = indexedDB.open(idbName);
      req.onsuccess = () => {
        const v = req.result.version;
        req.result.close();
        resolve(v);
      };
      req.onerror = () => resolve(1);
    });

    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(idbName, currentVersion + 1);
      req.onupgradeneeded = (e) => {
        const database = (e.target as IDBOpenDBRequest).result;
        for (const seed of seeds) {
          const name = `ownable:${seed.chainId}`;
          if (!database.objectStoreNames.contains(name)) {
            database.createObjectStore(name);
          }
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    for (const seed of seeds) {
      const storeName = `ownable:${seed.chainId}`;
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        store.put(seed.chainJson, 'chain');
        store.put(seed.packageCid, 'package');
        store.put(new Date().toISOString(), 'created');
        store.put([], 'keywords');
        store.put(seed.state, 'state');
        store.put(seed.latestHash, 'latestHash');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }

    db.close();
  }, { idbName: IDB_NAME, packages: PACKAGES, seeds });

  await this.page.reload({ waitUntil: 'networkidle' });
});

Given('I have a Dossier', async function () {
  await clearBrowserWalletState(this.page);
  await this.page.goto('/');
  await this.page.getByRole('button', { name: 'Issue an Ownable' }).click();
  await this.page.getByRole('button', { name: 'Ownable Builder' }).click();
  await this.page.getByLabel('Name *').fill('Dossier');
  await this.page.getByLabel('Description').fill('A living file dossier');
  await this.page.getByRole('button', { name: 'Create Ownable' }).click();
  await this.page.getByRole('heading', { name: 'Dossier' }).waitFor();
  await this.page.getByRole('button', { name: 'Add files' }).waitFor();
});

Given('the local Anchor preflight succeeds', async function () {
  const client = createE2EPublicClient();
  const chainId = await client.getChainId();
  if (chainId !== E2E_CHAIN_ID) {
    throw new Error(`Expected local chain ID ${E2E_CHAIN_ID} but received ${chainId}`);
  }

  const code = await client.getCode({ address: ANCHOR_ADDRESS });
  if (!code || code === '0x') {
    throw new Error(`Expected contract code at ${ANCHOR_ADDRESS}`);
  }

  const [eqtyCost, ethCost] = await Promise.all([
    client.readContract({
      address: ANCHOR_ADDRESS,
      abi: [
        {
          type: 'function',
          name: 'quoteEqtyCost',
          stateMutability: 'view',
          inputs: [{ name: 'count', type: 'uint256' }],
          outputs: [{ name: 'cost', type: 'uint256' }],
        },
      ],
      functionName: 'quoteEqtyCost',
      args: [1n],
    }),
    client.readContract({
      address: ANCHOR_ADDRESS,
      abi: [
        {
          type: 'function',
          name: 'quoteEthCost',
          stateMutability: 'view',
          inputs: [{ name: 'count', type: 'uint256' }],
          outputs: [{ name: 'cost', type: 'uint256' }],
        },
      ],
      functionName: 'quoteEthCost',
      args: [1n],
    }),
  ]);

  if (eqtyCost !== 0n) {
    throw new Error(`Expected quoteEqtyCost(1) to be 0 but received ${eqtyCost.toString()}`);
  }
  if (ethCost !== 0n) {
    throw new Error(`Expected quoteEthCost(1) to be 0 but received ${ethCost.toString()}`);
  }
});

When('the ownable widget is ready', async function () {
  await expectOwnableWidgetReady(this.page);
});

When('I forge the example ownable {string}', async function (title: string) {
  await this.page.goto('/');
  await ensureAnchoringEnabled(this.page);
  const examplesLink = this.page.getByRole('link', { name: 'the examples' });
  const issueButton = this.page.getByRole('button', { name: /Issue an Ownable/ });
  const isExamplesVisible = async () =>
    (await examplesLink.count()) > 0 && (await examplesLink.first().isVisible());
  const isIssueVisible = async () =>
    (await issueButton.count()) > 0 && (await issueButton.first().isVisible());
  const backButton = this.page.getByRole('button', { name: 'Back' }).first();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (await isExamplesVisible()) {
      break;
    }

    if (await isIssueVisible()) {
      await issueButton.first().click();
      break;
    }

    if ((await backButton.count()) > 0 && (await backButton.isVisible())) {
      await backButton.click({ force: true });
      continue;
    }

    await this.page.goto('/');
  }

  if (await isExamplesVisible()) {
    await examplesLink.click();
  } else {
    if (!(await isIssueVisible())) {
      if ((await backButton.count()) > 0) {
        await backButton.click({ force: true });
      }
    }

    if (await isExamplesVisible()) {
      await examplesLink.click();
    } else {
      await issueButton.click();
    }
  }
  const button = this.page.locator('button').filter({ hasText: title }).first();
  await button.waitFor();
  await button.click();
});

When('I start recording widget action messages', async function () {
  await this.page.evaluate(() => {
    const win = window as typeof window & {
      __ownableWidgetMessages?: Array<unknown>;
      __ownableWidgetMessageHandler?: (event: MessageEvent) => void;
    };

    win.__ownableWidgetMessages = [];
    if (win.__ownableWidgetMessageHandler) {
      window.removeEventListener('message', win.__ownableWidgetMessageHandler);
    }

    win.__ownableWidgetMessageHandler = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;
      if (!('type' in data) || !('ownable_id' in data) || !('msg' in data)) return;
      win.__ownableWidgetMessages?.push(data);
    };

    window.addEventListener('message', win.__ownableWidgetMessageHandler);
  });
});

Then(
  'the latest widget action message is an emit for {string}',
  async function (eventType: string) {
    const message = await this.page.evaluate(() => {
      const win = window as typeof window & {
        __ownableWidgetMessages?: Array<{
          type?: string;
          ownable_id?: string;
          msg?: Record<string, unknown>;
        }>;
      };

      return win.__ownableWidgetMessages?.at(-1) ?? null;
    });

    if (!message) {
      throw new Error('No widget action message was recorded');
    }

    if (message.type !== 'emit') {
      throw new Error(`Expected widget action type emit but received ${String(message.type)}`);
    }

    const keys = Object.keys(message.msg ?? {});
    if (keys.length !== 1 || keys[0] !== eventType) {
      throw new Error(
        `Expected widget emit envelope ${eventType} but received ${JSON.stringify(message.msg)}`
      );
    }
  }
);

When('I remember the current ownable id as {string}', async function (label: string) {
  const rememberedOwnableIds = ((this as any).rememberedOwnableIds ??= {});
  rememberedOwnableIds[label] = await currentOwnableId(this.page);
});

When('the Hub confirms the latest pending public event for the current ownable', async function () {
  const ownableId = await currentOwnableId(this.page);
  const records = await trackedPublicEvents(this.page, ownableId);
  const pendingRecord = [...records]
    .reverse()
    .find((record) => record.status === 'pending');

  if (!pendingRecord) {
    throw new Error(`No pending public event was found for ownable ${ownableId}`);
  }

  await ensureOwnableUploadedToHub(this.page, ownableId);
  runHubIndexer();
  await this.page.reload({ waitUntil: 'domcontentloaded' });
  await expectOwnableWidgetReady(this.page);
});

Then('the Hub recorded a public-events snapshot request for the current ownable', async function () {
  const ownableId = await currentOwnableId(this.page);
  await waitFor(
    async () => {
      const requests = (this as any).__hubRequests;
      return requests?.publicEventSnapshots?.find?.(
        (request: { ownableId: string }) => request.ownableId === ownableId
      ) ?? null;
    },
    Boolean,
    `public-events snapshot request for ${ownableId}`
  );
});

Then('the Hub recorded a public-events stream request for the current ownable set', async function () {
  const importedIds = await listImportedOwnableIds(this.page);
  const expectedIds =
    importedIds.length > 0 ? importedIds : [await currentOwnableId(this.page)];
  const request = await waitFor(
    async () => {
      const requests = (this as any).__hubRequests;
      const streamRequests = requests?.publicEventStreams ?? [];
      return (
        [...streamRequests]
          .reverse()
          .find((candidate: { ids: string[] }) =>
            JSON.stringify(candidate.ids) === JSON.stringify(expectedIds)
          ) ?? null
      );
    },
    Boolean,
    `public-events stream request for ${expectedIds.join(',')}`
  );

  (this as any).latestPublicEventStreamRequest = request;
});

Then(
  'the Hub recorded a later public-events stream request for remembered ownables {string}',
  async function (labels: string) {
    const rememberedOwnableIds = (this as any).rememberedOwnableIds ?? {};
    const expectedIds = labels
      .split(',')
      .map((label) => rememberedOwnableIds[label.trim()])
      .filter(Boolean)
      .sort();

    if (expectedIds.length === 0) {
      throw new Error(`No remembered ownable ids were found for ${labels}`);
    }

    const request = await waitFor(
      async () => {
        const requests = (this as any).__hubRequests;
        const streamRequests = requests?.publicEventStreams ?? [];
        return (
          [...streamRequests]
            .reverse()
            .find((candidate: { ids: string[] }) =>
              JSON.stringify(candidate.ids) === JSON.stringify(expectedIds)
            ) ?? null
        );
      },
      Boolean,
      `later public-events stream request for ${expectedIds.join(',')}`
    );

    (this as any).latestPublicEventStreamRequest = request;
  }
);

Then(
  'the latest Hub public-events stream request uses only repeated {string} params plus {string}',
  async function (idParamName: string, fromParamName: string) {
    const request = (this as any).latestPublicEventStreamRequest as
      | { queryEntries: Array<[string, string]>; queryKeys: string[] }
      | undefined;

    if (!request) {
      throw new Error('No public-events stream request has been recorded');
    }

    const uniqueKeys = [...new Set(request.queryKeys)];
    if (
      JSON.stringify(uniqueKeys.sort()) !==
      JSON.stringify([fromParamName, idParamName].sort())
    ) {
      throw new Error(
        `Expected only ${idParamName} and ${fromParamName} query keys but received ${JSON.stringify(uniqueKeys)}`
      );
    }

    if (!request.queryEntries.some(([key]) => key === fromParamName)) {
      throw new Error(`Expected a ${fromParamName} query parameter`);
    }

    const idEntries = request.queryEntries.filter(([key]) => key === idParamName);
    if (idEntries.length < 1) {
      throw new Error(`Expected at least one repeated ${idParamName} query parameter`);
    }
  }
);

Then(
  'the tracked public-event status for the current ownable becomes {string} for {string}',
  async function (status: 'pending' | 'confirmed', eventType: string) {
    const ownableId = await currentOwnableId(this.page);
    const record = await waitFor(
      async () => {
        const records = await trackedPublicEvents(this.page, ownableId);
        return (
          [...records]
            .reverse()
            .find(
              (candidate) =>
                candidate.status === status && candidate.event.eventType === eventType
            ) ?? null
        );
      },
      Boolean,
      `${status} tracked public event ${eventType}`
    );

    if (!record) {
      throw new Error(`Missing ${status} tracked public event ${eventType}`);
    }
  }
);

Then(
  'there is exactly {string} tracked public event for {string} on the current ownable',
  async function (countText: string, eventType: string) {
    const ownableId = await currentOwnableId(this.page);
    const expectedCount = Number.parseInt(countText, 10);
    const records = await trackedPublicEvents(this.page, ownableId);
    const matches = records.filter((record) => record.event.eventType === eventType);

    if (matches.length !== expectedCount) {
      throw new Error(
        `Expected ${expectedCount} tracked public events for ${eventType} but found ${matches.length}: ${debugString(matches)}`
      );
    }
  }
);

When(
  'I upload the file {string} into the {string} file input',
  async function (filePath: string, placeholder: string) {
    const absolutePath = path.resolve(PROJECT_ROOT, filePath);
    const inputName = `${placeholder
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')}-input`;
    const input = this.page.locator(
      `input[type="file"][name="${inputName}"]`
    );
    await input.setInputFiles(absolutePath);
  }
);

When('I open the Anchor allowance dialog', async function () {
  const changeButton = this.page.getByRole('button', { name: 'change' });
  if ((await changeButton.count()) === 0) {
    await this.page.getByRole('button', { name: 'menu' }).click();
  }
  await changeButton.click();
});

When('I save the Anchor allowance amount {string}', async function (amount: string) {
  await this.page.getByLabel('Allowance amount (EQTY)').fill(amount);
  await this.page.getByRole('button', { name: 'Save allowance' }).click();
});

When('I reset the Anchor allowance to zero', async function () {
  await this.page.getByRole('button', { name: 'Reset to zero' }).click();
});

Then('the Anchor allowance is shown as {string}', async function (amountLabel: string) {
  await this.page.getByText(`Allowance: ${amountLabel}`).waitFor();
});

Then('the local EQTY allowance is {string}', async function (amount: string) {
  const client = createE2EPublicClient();
  const allowance = await waitFor(
    async () =>
      client.readContract({
        address: EQTY_TOKEN_ADDRESS,
        abi: [
          {
            type: 'function',
            name: 'allowance',
            stateMutability: 'view',
            inputs: [
              { name: 'owner', type: 'address' },
              { name: 'spender', type: 'address' },
            ],
            outputs: [{ name: 'remaining', type: 'uint256' }],
          },
        ],
        functionName: 'allowance',
        args: [E2E_ADDRESS, ANCHOR_ADDRESS],
      }),
    (value) => formatUnits(value, 18) === formatUnits(parseUnits(amount, 18), 18),
    `EQTY allowance ${amount}`
  );

  if (allowance !== parseUnits(amount, 18)) {
    throw new Error(
      `Expected EQTY allowance ${amount} but received ${formatUnits(allowance, 18)}`
    );
  }
});
