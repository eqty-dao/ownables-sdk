import type { Page, Request as PlaywrightRequest } from '@playwright/test';
import JSZip from 'jszip';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mnemonicToAccount } from 'viem/accounts';
import { expectOwnableWidgetReady } from './ownable-widget.ts';

const DEFAULT_E2E_MNEMONIC =
  'test test test test test test test test test test test junk';
const E2E_CHAIN_ID = 84532; // Base Sepolia
const E2E_ADDRESS = resolveE2EAddress();
const IDB_PREFIX = `ownables:${E2E_CHAIN_ID}:`;
const IDB_NAME = `ownables:${E2E_CHAIN_ID}:${E2E_ADDRESS}`;
const PROJECT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
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

interface PublicEventSnapshotRequest {
  ownableId: string;
}

interface PublicEventStreamRequest {
  ids: string[];
  from: number;
  queryEntries: Array<[string, string]>;
  queryKeys: string[];
}

export interface PublicEventsWorld {
  page: Page;
  __hubRequestHandler?: (request: PlaywrightRequest) => void;
  __hubRequests?: {
    publicEventSnapshots: PublicEventSnapshotRequest[];
    publicEventStreams: PublicEventStreamRequest[];
  };
  rememberedOwnableIds?: Record<string, string>;
  latestPublicEventStreamRequest?: PublicEventStreamRequest;
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

function ensureHubRequestRecorder(world: PublicEventsWorld) {
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

  const handler = (request: PlaywrightRequest) => {
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

async function resolveOwnablesDatabaseName(page: Page): Promise<string> {
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

async function listImportedOwnableIds(page: Page): Promise<string[]> {
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
  page: Page,
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
  page: Page,
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

async function ensureOwnableUploadedToHub(page: Page, ownableId: string): Promise<void> {
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

async function currentOwnableId(page: Page): Promise<string> {
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

async function trackedPublicEvents(page: Page, ownableId: string): Promise<TrackedPublicEventRecord[]> {
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

    const records = await new Promise<TrackedPublicEventRecord[]>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const request = tx.objectStore(storeName).getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    db.close();
    return records;
  }, { idbName, ownableId });
}

async function publicEventDiagnostics(page: Page, ownableId: string) {
  const idbName = await resolveOwnablesDatabaseName(page);
  const storeName = `ownable:${ownableId}.public-event-replays`;
  const directRecords = await trackedPublicEvents(page, ownableId);
  const serviceDiagnostics = await page.evaluate(() => {
    const win = window as typeof window & {
      __ownablesPublicEventDiagnostics?: {
        chainId: string;
        eventType: string;
        coreArtifact: string;
        serviceRecords: unknown[];
        pollAttempt: number;
      };
    };
    return win.__ownablesPublicEventDiagnostics ?? null;
  });

  const summarize = (records: unknown[]) =>
    records.map((record: any) => ({
      replayKey: record?.replayKey,
      status: record?.status,
      eventType: record?.event?.eventType,
      sources: record?.sources,
    }));

  return {
      chainId: String(E2E_CHAIN_ID),
    databaseName: idbName,
    storeName,
    coreArtifact: serviceDiagnostics?.coreArtifact ?? 'unknown (runtime provenance not exposed)',
    serviceRecords: summarize(serviceDiagnostics?.serviceRecords ?? []),
    directRecords: summarize(directRecords),
  };
}
export function resetHubTransport(world: PublicEventsWorld) {
  ensureHubRequestRecorder(world);
  world.__hubRequests = {
    publicEventSnapshots: [],
    publicEventStreams: [],
  };
  world.rememberedOwnableIds = {};
}

export async function startRecordingWidgetActionMessages(page: Page) {
  await page.evaluate(() => {
    const win = window as typeof window & {
      __ownableWidgetMessages?: Array<unknown>;
      __ownableWidgetMessageHandler?: (event: MessageEvent) => void;
      __ownablesPublicEventDiagnosticsEnabled?: boolean;
    };

    win.__ownableWidgetMessages = [];
    win.__ownablesPublicEventDiagnosticsEnabled = true;
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
}

export async function expectLatestWidgetActionMessage(page: Page, eventType: string) {
  const message = await page.evaluate(() => {
    const win = window as typeof window & {
      __ownableWidgetMessages?: Array<{
        type?: string;
        ownable_id?: string;
        msg?: Record<string, unknown>;
      }>;
    };
    return win.__ownableWidgetMessages?.at(-1) ?? null;
  });

  if (!message) throw new Error('No widget action message was recorded');
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

export async function rememberCurrentOwnableId(
  world: PublicEventsWorld,
  label: string
) {
  const remembered = (world.rememberedOwnableIds ??= {});
  remembered[label] = await currentOwnableId(world.page);
}

export async function confirmLatestPendingPublicEvent(page: Page) {
  const ownableId = await currentOwnableId(page);
  const records = await trackedPublicEvents(page, ownableId);
  const pendingRecord = [...records]
    .reverse()
    .find((record) => record.status === 'pending');

  if (!pendingRecord) {
    throw new Error(`No pending public event was found for ownable ${ownableId}`);
  }

  await ensureOwnableUploadedToHub(page, ownableId);
  runHubIndexer();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expectOwnableWidgetReady(page);
}

export async function expectHubSnapshotRequest(world: PublicEventsWorld) {
  const ownableId = await currentOwnableId(world.page);
  await waitFor(
    async () =>
      world.__hubRequests?.publicEventSnapshots.find(
        (request) => request.ownableId === ownableId
      ) ?? null,
    Boolean,
    `public-events snapshot request for ${ownableId}`
  );
}

export async function expectHubStreamRequest(world: PublicEventsWorld) {
  const importedIds = await listImportedOwnableIds(world.page);
  const expectedIds =
    importedIds.length > 0 ? importedIds : [await currentOwnableId(world.page)];
  const request = await waitFor(
    async () =>
      [...(world.__hubRequests?.publicEventStreams ?? [])]
        .reverse()
        .find(
          (candidate) =>
            JSON.stringify(candidate.ids) === JSON.stringify(expectedIds)
        ) ?? null,
    Boolean,
    `public-events stream request for ${expectedIds.join(',')}`
  );

  world.latestPublicEventStreamRequest = request;
}

export async function expectLaterHubStreamRequest(
  world: PublicEventsWorld,
  labels: string
) {
  const remembered = world.rememberedOwnableIds ?? {};
  const expectedIds = labels
    .split(',')
    .map((label) => remembered[label.trim()])
    .filter((id): id is string => Boolean(id))
    .sort();

  if (expectedIds.length === 0) {
    throw new Error(`No remembered ownable ids were found for ${labels}`);
  }

  const request = await waitFor(
    async () =>
      [...(world.__hubRequests?.publicEventStreams ?? [])]
        .reverse()
        .find(
          (candidate) =>
            JSON.stringify(candidate.ids) === JSON.stringify(expectedIds)
        ) ?? null,
    Boolean,
    `later public-events stream request for ${expectedIds.join(',')}`
  );

  world.latestPublicEventStreamRequest = request;
}

export function expectLatestHubStreamQuery(
  world: PublicEventsWorld,
  idParamName: string,
  fromParamName: string
) {
  const request = world.latestPublicEventStreamRequest;
  if (!request) throw new Error('No public-events stream request has been recorded');

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
  if (!request.queryEntries.some(([key]) => key === idParamName)) {
    throw new Error(`Expected at least one repeated ${idParamName} query parameter`);
  }
}

export async function expectTrackedPublicEventStatus(
  page: Page,
  status: 'pending' | 'confirmed',
  eventType: string
) {
  const ownableId = await currentOwnableId(page);
  try {
    await waitFor(
      async () =>
        [...(await trackedPublicEvents(page, ownableId))]
          .reverse()
          .find(
            (candidate) =>
              candidate.status === status &&
              candidate.event.eventType === eventType
          ) ?? null,
      Boolean,
      `${status} tracked public event ${eventType}`
    );
  } catch (error) {
    const diagnostics = await publicEventDiagnostics(page, ownableId);
    throw new Error(`${String(error)}; diagnostics=${debugString(diagnostics)}`);
  }

  if (status === 'pending') {
    console.log(
      `PUBLIC_EVENT_DIAGNOSTICS ${debugString(
        await publicEventDiagnostics(page, ownableId)
      )}`
    );
  }
}

export async function expectTrackedPublicEventCount(
  page: Page,
  countText: string,
  eventType: string
) {
  const ownableId = await currentOwnableId(page);
  const expectedCount = Number.parseInt(countText, 10);
  const records = await trackedPublicEvents(page, ownableId);
  const matches = records.filter((record) => record.event.eventType === eventType);

  if (matches.length !== expectedCount) {
    throw new Error(
      `Expected ${expectedCount} tracked public events for ${eventType} but found ${matches.length}: ${debugString(matches)}`
    );
  }
}
