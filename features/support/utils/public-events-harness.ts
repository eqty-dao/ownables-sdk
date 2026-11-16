import { expect, type Page, type Request as PlaywrightRequest } from '@playwright/test';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { request as httpRequest } from 'node:http';
import { createConnection } from 'node:net';
import { fileURLToPath } from 'node:url';
import { mnemonicToAccount } from 'viem/accounts';
import { loadE2ERuntimeEnvironment } from './e2e-runtime.ts';

loadE2ERuntimeEnvironment();

const DEFAULT_E2E_MNEMONIC =
  'test test test test test test test test test test test junk';
const E2E_CHAIN_ID = 84532; // Base Sepolia
const E2E_ADDRESS = resolveE2EAddress();
const IDB_PREFIX = `ownables:${E2E_CHAIN_ID}:`;
const IDB_NAME = `ownables:${E2E_CHAIN_ID}:${E2E_ADDRESS}`;
export const PUBLIC_EVENT_STREAM_EVENT_TYPES = ['message', 'public-event'] as const;
const PROJECT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..'
);
let hubProjectRoot: string | undefined;

interface ActiveHubProcess {
  child?: ChildProcess;
  processId: number;
}

let activeHub: ActiveHubProcess | undefined;
let exitFallbackInstalled = false;

interface PublicEventHarnessTestAdapters {
  createReplacementHub?: () => ChildProcess;
  hubIsHealthy?: () => Promise<boolean>;
  hubListenerIsOpen?: () => Promise<boolean>;
  killProcess?: (processId: number, signal: NodeJS.Signals) => void;
  serverFailureDiagnostics?: (
    confirmedEvent: CapturedPublicEventView['confirmedEvent']
  ) => Promise<Record<string, unknown>>;
}

let testAdapters: PublicEventHarnessTestAdapters | undefined;

function hubOrigin(): string {
  return process.env.VITE_HUB?.trim().replace(/\/$/, '') ?? '';
}

function artifactDirectory(): string | undefined {
  return process.env.E2E_ARTIFACT_DIR?.trim();
}

export function configurePublicEventHarnessForTest(
  adapters?: PublicEventHarnessTestAdapters
): void {
  testAdapters = adapters;
  activeHub = undefined;
}

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

interface PublicEventSnapshotRequest {
  ownableId: string;
}

interface PublicEventStreamRequest {
  ids: string[];
  fromBlock?: number;
  queryEntries: Array<[string, string]>;
  queryKeys: string[];
}

interface CapturedPublicEventView {
  ownableId: string;
  widgetId: string;
  url: string;
  rowTestIds: string[];
  confirmedEvent?: Pick<TrackedPublicEventRecord['event'], 'transactionHash' | 'logIndex' | 'blockNumber'>;
}

interface PublicEventStreamMessage {
  data: unknown;
  url: string;
}

interface PublicEventBrowserDiagnostics {
  console: Array<{ type: string; text: string }>;
  pageErrors: string[];
  requestFailures: Array<{ url: string; failure: string }>;
  streamMessages: PublicEventStreamMessage[];
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
  capturedPublicEventView?: CapturedPublicEventView;
  __publicEventBrowserDiagnostics?: PublicEventBrowserDiagnostics;
  __publicEventDiagnosticsInstalled?: boolean;
}

function resolveHubProjectRoot(): string {
  const configuredHubRoot = process.env.E2E_HUB_ROOT?.trim();
  if (configuredHubRoot) {
    const hubRoot = path.resolve(configuredHubRoot);
    if (!existsSync(path.join(hubRoot, 'package.json'))) {
      throw new Error(`E2E_HUB_ROOT is not an ownables-hub repository: ${hubRoot}`);
    }
    return hubRoot;
  }

  const result = spawnSync(
    'git',
    ['rev-parse', '--path-format=absolute', '--git-common-dir'],
    { cwd: PROJECT_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  );

  if (result.error || result.status !== 0) {
    const detail = result.error?.message ?? result.stderr?.trim() ?? 'unknown error';
    throw new Error(`Unable to resolve the Git common directory for E2E Hub access: ${detail}`);
  }

  const commonDir = result.stdout.trim();
  const hubRoot = path.join(path.dirname(path.dirname(commonDir)), 'ownables-hub');
  if (!existsSync(hubRoot)) {
    throw new Error(`Unable to resolve ownables-hub from Git common directory ${commonDir}`);
  }

  return hubRoot;
}

function hubProjectRootForRealProof(): string {
  if (!hubProjectRoot) {
    hubProjectRoot = resolveHubProjectRoot();
  }

  return hubProjectRoot;
}

function resolveE2EAddress() {
  const mnemonic = process.env.VITE_E2E_MNEMONIC?.trim() || DEFAULT_E2E_MNEMONIC;
  const indexRaw = process.env.VITE_E2E_ADDRESS_INDEX;
  const addressIndex = Number.isFinite(Number(indexRaw)) ? Number(indexRaw) : 0;
  return mnemonicToAccount(mnemonic, { addressIndex }).address.toLowerCase();
}

function debugString(value: unknown) {
  return JSON.stringify(value, (_, currentValue) =>
    typeof currentValue === 'bigint' ? currentValue.toString() : currentValue
  );
}

async function waitFor<T>(
  getValue: () => Promise<T | null>,
  validate: (value: T) => boolean,
  label: string,
  timeoutMs = 10_000,
  pollIntervalMs = 200
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
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(
    `${label} timed out${lastValue === null ? '' : `: ${debugString(lastValue)}`}`
  );
}

function boundedPush<T>(items: T[], value: T, limit = 100): void {
  items.push(value);
  if (items.length > limit) items.splice(0, items.length - limit);
}

export function installPublicEventStreamCapture(eventTypes: readonly string[]): void {
  const win = window as typeof window & {
    __ownablesPublicEventStreamMessages?: Array<{ url: string; data: unknown }>;
    __ownablesPublicEventStreamDisconnectCount?: number;
    __ownablesPublicEventSourceWrapped?: boolean;
  };
  if (win.__ownablesPublicEventSourceWrapped) return;

  win.__ownablesPublicEventSourceWrapped = true;
  win.__ownablesPublicEventStreamMessages = [];
  win.__ownablesPublicEventStreamDisconnectCount = 0;
  const NativeEventSource = window.EventSource;
  window.EventSource = class extends NativeEventSource {
    constructor(url: string | URL, configuration?: EventSourceInit) {
      super(url, configuration);
      const rawUrl = String(url);
      if (new URL(rawUrl, window.location.href).pathname === '/public-events') {
        const recordStreamEvent = (event: Event) => {
          let data: unknown = (event as MessageEvent).data;
          try {
            data = JSON.parse(event.data);
          } catch {
            // Keep malformed payloads for failure evidence.
          }
          const messages = win.__ownablesPublicEventStreamMessages ?? [];
          messages.push({ url: rawUrl, data });
          if (messages.length > 100) messages.splice(0, messages.length - 100);
        };
        for (const eventType of eventTypes) {
          this.addEventListener(eventType, recordStreamEvent);
        }
        this.addEventListener('error', () => {
          win.__ownablesPublicEventStreamDisconnectCount =
            (win.__ownablesPublicEventStreamDisconnectCount ?? 0) + 1;
        });
      }
    }
  } as typeof EventSource;
}

async function installPublicEventDiagnostics(world: PublicEventsWorld): Promise<void> {
  if (world.__publicEventDiagnosticsInstalled) return;

  world.__publicEventBrowserDiagnostics = {
    console: [],
    pageErrors: [],
    requestFailures: [],
    streamMessages: [],
  };

  const eventTypes = [...PUBLIC_EVENT_STREAM_EVENT_TYPES];
  await world.page.addInitScript(installPublicEventStreamCapture, eventTypes);
  await world.page.evaluate(installPublicEventStreamCapture, eventTypes);

  world.page.on('console', (message) => {
    boundedPush(world.__publicEventBrowserDiagnostics!.console, {
      type: message.type(),
      text: message.text(),
    });
  });
  world.page.on('pageerror', (error) => {
    boundedPush(world.__publicEventBrowserDiagnostics!.pageErrors, error.stack ?? error.message);
  });
  world.page.on('requestfailed', (request) => {
    boundedPush(world.__publicEventBrowserDiagnostics!.requestFailures, {
      url: request.url(),
      failure: request.failure()?.errorText ?? 'unknown request failure',
    });
  });
  world.__publicEventDiagnosticsInstalled = true;
}

async function readPublicEventStreamMessages(page: Page): Promise<PublicEventStreamMessage[]> {
  return page.evaluate(() => {
    const win = window as typeof window & {
      __ownablesPublicEventStreamMessages?: Array<{ url: string; data: unknown }>;
    };
    return win.__ownablesPublicEventStreamMessages ?? [];
  });
}

async function publicEventStreamDisconnectCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const win = window as typeof window & {
      __ownablesPublicEventStreamDisconnectCount?: number;
    };
    return win.__ownablesPublicEventStreamDisconnectCount ?? 0;
  });
}

export async function waitForPublicEventStreamDisconnect(
  page: Page,
  initialCount: number,
  timeoutMs = 10_000,
  pollIntervalMs = 200
): Promise<void> {
  await waitFor(
    async () => {
      const count = await publicEventStreamDisconnectCount(page);
      return count > initialCount ? count : null;
    },
    Boolean,
    'browser public-events stream disconnect after Hub shutdown',
    timeoutMs,
    pollIntervalMs
  );
}

function ensureHubRequestRecorder(world: PublicEventsWorld) {
  const page = world.page;
  const origin = hubOrigin();
  if (!page || !origin) {
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
      if (!url.href.startsWith(origin)) {
        return;
      }

      const publicEventsSnapshotMatch = url.pathname.match(/^\/ownables\/([^/]+)\/public-events$/);
      if (publicEventsSnapshotMatch) {
        world.__hubRequests.publicEventSnapshots.push({
          ownableId: decodeURIComponent(publicEventsSnapshotMatch[1]),
        });
        return;
      }

      if (url.pathname === '/public-events') {
        world.__hubRequests.publicEventStreams.push({
          ids: url.searchParams.getAll('ownableId').sort(),
          fromBlock: url.searchParams.has('fromBlock')
            ? Number(url.searchParams.get('fromBlock'))
            : undefined,
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

function runtimeEnvironment(variable: string): Record<string, string> {
  const encodedRuntimeEnv = process.env[variable];
  if (!encodedRuntimeEnv) {
    throw new Error(`${variable} is required for the real-Hub proof lane`);
  }

  let runtimeEnv: Record<string, string>;
  try {
    const parsed = JSON.parse(encodedRuntimeEnv) as unknown;
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      Object.values(parsed).some((value) => typeof value !== 'string')
    ) {
      throw new Error('must be an object containing only string values');
    }
    runtimeEnv = parsed as Record<string, string>;
  } catch (error) {
    throw new Error(
      `Invalid ${variable}: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  return runtimeEnv;
}

export function runHubIndexer(): void {
  const runtimeEnv = runtimeEnvironment('E2E_HUB_INDEXER_ENV_JSON');

  const result = spawnSync('yarn', ['indexer:run'], {
    cwd: hubProjectRootForRealProof(),
    env: { ...process.env, ...runtimeEnv },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 60_000,
  });

  if (result.error) {
    throw new Error(
      `yarn indexer:run failed: ${result.error.message}\nstdout:\n${result.stdout?.trim() ?? ''}\nstderr:\n${result.stderr?.trim() ?? ''}`
    );
  }

  if (result.status !== 0) {
    const stderr = result.stderr?.trim();
    const stdout = result.stdout?.trim();
    throw new Error(
      stderr
        ? `yarn indexer:run failed:\n${stderr}\nstdout:\n${stdout ?? ''}`
        : `yarn indexer:run failed with code ${String(result.status)}\nstdout:\n${stdout ?? ''}\nstderr:\n`
    );
  }

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
export async function resetHubTransport(world: PublicEventsWorld) {
  await installPublicEventDiagnostics(world);
  await world.page.evaluate(() => {
    const win = window as typeof window & {
      __ownablesPublicEventStreamMessages?: Array<{ url: string; data: unknown }>;
      __ownablesPublicEventStreamDisconnectCount?: number;
    };
    win.__ownablesPublicEventStreamMessages = [];
    win.__ownablesPublicEventStreamDisconnectCount = 0;
  });
  if (world.__publicEventBrowserDiagnostics) {
    world.__publicEventBrowserDiagnostics.console = [];
    world.__publicEventBrowserDiagnostics.pageErrors = [];
    world.__publicEventBrowserDiagnostics.requestFailures = [];
    world.__publicEventBrowserDiagnostics.streamMessages = [];
  }
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
      __lastVerifiedOwnableWidgetMessageCount?: number;
      __ownablesPublicEventDiagnosticsEnabled?: boolean;
    };

    win.__ownableWidgetMessages = [];
    win.__lastVerifiedOwnableWidgetMessageCount = 0;
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
  const message = await waitFor(
    () =>
      page.evaluate(() => {
        const win = window as typeof window & {
          __ownableWidgetMessages?: Array<{
            type?: string;
            ownable_id?: string;
            msg?: Record<string, unknown>;
          }>;
          __lastVerifiedOwnableWidgetMessageCount?: number;
        };
        const messages = win.__ownableWidgetMessages ?? [];
        const previousCount = win.__lastVerifiedOwnableWidgetMessageCount ?? 0;
        if (messages.length <= previousCount) {
          return null;
        }

        win.__lastVerifiedOwnableWidgetMessageCount = messages.length;
        return messages.at(-1) ?? null;
      }),
    Boolean,
    'new widget action message'
  );

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

  runHubIndexer();
}

function visiblePublicEventRows(page: Page) {
  return page.locator('[data-testid^="public-event-"]');
}

async function isProcessingWidgetAction(page: Page): Promise<boolean> {
  const dialog = page.getByRole('dialog', { name: 'Processing action' });
  return (await dialog.count()) > 0 && (await dialog.first().isVisible());
}

export async function expectVisiblePublicEventRows(
  page: Page,
  countText: string,
  eventType: string,
  status: 'pending' | 'confirmed'
): Promise<string[]> {
  const expectedCount = Number.parseInt(countText, 10);
  if (!Number.isInteger(expectedCount) || expectedCount < 0) {
    throw new Error(`Invalid expected visible public-event count: ${countText}`);
  }

  return waitFor(
    async () => {
      const rows = visiblePublicEventRows(page);
      if ((await rows.count()) !== expectedCount) {
        return null;
      }

      const rowTestIds: string[] = [];
      for (let index = 0; index < expectedCount; index += 1) {
        const row = rows.nth(index);
        const testId = await row.getAttribute('data-testid');
        const text = await row.textContent();
        if (
          !testId ||
          !text?.includes(`Public event: ${eventType}`) ||
          !text.includes(status === 'pending' ? 'Pending' : 'Confirmed')
        ) {
          return null;
        }
        rowTestIds.push(testId);
      }

      return rowTestIds;
    },
    (rowTestIds): rowTestIds is string[] => rowTestIds !== null,
    `${expectedCount} visible ${status} public-event rows for ${eventType}`,
    20_000
  );
}

export async function captureVisiblePublicEventView(
  world: PublicEventsWorld,
  countText: string,
  eventType: string,
  status: 'pending' | 'confirmed'
) {
  const ownableId = await currentOwnableId(world.page);
  const rowTestIds = await expectVisiblePublicEventRows(
    world.page,
    countText,
    eventType,
    status
  );

  world.capturedPublicEventView = {
    ownableId,
    widgetId: (await world.page.locator('iframe[aria-label="Ownable widget"]').getAttribute('id')) ?? '',
    url: world.page.url(),
    rowTestIds,
  };
}

export async function expectCapturedPublicEventView(
  world: PublicEventsWorld,
  eventType: string,
  status: 'pending' | 'confirmed'
) {
  const captured = world.capturedPublicEventView;
  if (!captured) {
    throw new Error('No public-event view was captured before confirmation');
  }

  const currentOwnable = await currentOwnableId(world.page);
  if (currentOwnable !== captured.ownableId) {
    throw new Error(
      `The selected ownable changed from ${captured.ownableId} to ${currentOwnable} during confirmation`
    );
  }
  if (world.page.url() !== captured.url) {
    throw new Error(`The page navigated during public-event confirmation: ${world.page.url()}`);
  }
  const widgetId = await world.page.locator('iframe[aria-label="Ownable widget"]').getAttribute('id');
  if (widgetId !== captured.widgetId) {
    throw new Error(`The widget changed from ${captured.widgetId} to ${String(widgetId)}`);
  }

  const currentRowTestIds = await expectVisiblePublicEventRows(
    world.page,
    String(captured.rowTestIds.length),
    eventType,
    status
  );
  expect(currentRowTestIds).toEqual(captured.rowTestIds);

  if (status === 'confirmed') {
    const record = [...(await trackedPublicEvents(world.page, captured.ownableId))]
      .reverse()
      .find((candidate) =>
        candidate.status === 'confirmed' && candidate.event.eventType === eventType
      );
    if (!record) {
      throw new Error(`No confirmed ${eventType} replay record was found for ${captured.ownableId}`);
    }
    captured.confirmedEvent = {
      transactionHash: record.event.transactionHash,
      logIndex: record.event.logIndex,
      blockNumber: record.event.blockNumber,
    };
  }
}

async function waitForHubHealth() {
  if (!hubOrigin()) {
    throw new Error('VITE_HUB is required for the real-Hub proof lane');
  }

  await waitFor(
    async () => ((await hubIsHealthy()) ? true : null),
    Boolean,
    'replacement ownables-hub runtime',
    20_000
  );
}

function hubIsHealthy(): Promise<boolean> {
  if (testAdapters?.hubIsHealthy) return testAdapters.hubIsHealthy();
  const origin = hubOrigin();
  if (!origin) {
    return Promise.resolve(false);
  }

  const url = new URL(`${origin}/health`);
  return new Promise((resolve) => {
    const request = httpRequest(
      {
        hostname: url.hostname,
        port: url.port || undefined,
        path: `${url.pathname}${url.search}`,
        method: 'GET',
        agent: false,
        timeout: 1_000,
      },
      (response) => {
        response.resume();
        response.once('end', () => resolve(response.statusCode === 200));
      }
    );

    request.once('error', () => resolve(false));
    request.once('timeout', () => {
      request.destroy();
      resolve(false);
    });
    request.end();
  });
}

function hubListenerIsOpen(): Promise<boolean> {
  if (testAdapters?.hubListenerIsOpen) return testAdapters.hubListenerIsOpen();
  const origin = hubOrigin();
  if (!origin) return Promise.resolve(false);

  const url = new URL(origin);
  const port = url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80;
  return new Promise((resolve) => {
    let settled = false;
    const socket = createConnection({ host: url.hostname, port });
    const finish = (isOpen: boolean) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(isOpen);
    };
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.setTimeout(1_000, () => finish(true));
  });
}

async function waitForHubListenerShutdown(label: string): Promise<void> {
  await waitFor(
    async () => (!(await hubListenerIsOpen()) ? true : null),
    Boolean,
    label,
    10_000
  );
}

function signalHubProcess(processId: number, signal: NodeJS.Signals): boolean {
  try {
    if (testAdapters?.killProcess) {
      testAdapters.killProcess(processId, signal);
    } else {
      process.kill(processId, signal);
    }
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ESRCH') return false;
    throw error;
  }
}

function initialHubProcess(): ActiveHubProcess {
  if (activeHub) return activeHub;

  const processId = Number.parseInt(process.env.E2E_HUB_PROCESS_ID ?? '', 10);
  if (!Number.isSafeInteger(processId) || processId <= 0) {
    throw new Error('E2E_HUB_PROCESS_ID must contain the running Hub process id');
  }
  activeHub = { processId };
  return activeHub;
}

function appendHubRestartLog(message: string): void {
  const directory = artifactDirectory();
  if (directory) {
    appendFileSync(path.join(directory, 'hub-restarts.log'), `${message}\n`);
  }
}

function mirrorReplacementHubOutput(hub: ChildProcess): void {
  const output = (chunk: Buffer) => {
    process.stdout.write(chunk);
    appendHubRestartLog(chunk.toString());
  };
  hub.stdout?.on('data', output);
  hub.stderr?.on('data', (chunk: Buffer) => {
    process.stderr.write(chunk);
    appendHubRestartLog(chunk.toString());
  });
}

async function waitForChildExit(hub: ChildProcess, label: string): Promise<void> {
  if (hub.exitCode !== null || hub.signalCode !== null) return;

  const exited = new Promise<void>((resolve) => hub.once('exit', () => resolve()));
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, 5_000));
  await Promise.race([exited, timeout]);
  if (hub.exitCode === null && hub.signalCode === null) {
    hub.kill('SIGKILL');
    await Promise.race([exited, new Promise<void>((resolve) => setTimeout(resolve, 5_000))]);
  }
  if (hub.exitCode === null && hub.signalCode === null) {
    throw new Error(`${label} did not terminate`);
  }
}

async function stopActiveHub(): Promise<void> {
  const hub = activeHub;
  if (!hub) return;

  activeHub = undefined;
  if (hub.child) {
    if (hub.child.exitCode === null && hub.child.signalCode === null) {
      appendHubRestartLog(`Stopping replacement Hub process ${hub.processId}`);
      hub.child.kill('SIGTERM');
    }
    await waitForChildExit(hub.child, `replacement ownables-hub process ${hub.processId}`);
    await waitForHubListenerShutdown(`replacement ownables-hub listener ${hub.processId} shutdown`);
    return;
  }

  if (!(await hubListenerIsOpen())) {
    appendHubRestartLog(`Setup Hub listener is already closed, not signalling process ${hub.processId}`);
    return;
  }

  signalHubProcess(hub.processId, 'SIGTERM');
  await waitForHubListenerShutdown(`ownables-hub listener ${hub.processId} shutdown`);
  // Hub graceful shutdown closes its listener before it closes existing SSE sockets.
  // The setup-owned runtime must be forcefully terminated before its replacement starts.
  signalHubProcess(hub.processId, 'SIGKILL');
}

function installProcessExitFallback(): void {
  if (exitFallbackInstalled) return;
  exitFallbackInstalled = true;
  process.once('exit', () => {
    const hub = activeHub?.child;
    if (hub && hub.exitCode === null && hub.signalCode === null) {
      hub.kill('SIGTERM');
    }
  });
}

export async function restartHubForPublicEventReplay(page?: Page): Promise<void> {
  if (!hubOrigin()) {
    throw new Error('VITE_HUB is required for the real-Hub proof lane');
  }

  const initialDisconnectCount = page
    ? await publicEventStreamDisconnectCount(page)
    : undefined;
  initialHubProcess();
  await stopActiveHub();
  if (page && initialDisconnectCount !== undefined) {
    await waitForPublicEventStreamDisconnect(page, initialDisconnectCount);
  }

  const runtimeEnv = runtimeEnvironment('E2E_HUB_RUNTIME_ENV_JSON');
  const hub = testAdapters?.createReplacementHub?.() ?? spawn(
    process.execPath,
    ['--preserve-symlinks', '--env-file-if-exists=.env', 'dist/main.js'],
    {
      cwd: hubProjectRootForRealProof(),
      env: { ...process.env, ...runtimeEnv },
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );
  if (!hub.pid) {
    throw new Error('replacement ownables-hub runtime did not expose a process id');
  }
  activeHub = { child: hub, processId: hub.pid };
  installProcessExitFallback();
  mirrorReplacementHubOutput(hub);
  hub.once('error', (error) => appendHubRestartLog(`Replacement Hub failed: ${error.message}`));
  appendHubRestartLog(`Started replacement Hub process ${hub.pid}`);

  await waitForHubHealth();
}

export async function stopActiveReplacementHub(): Promise<void> {
  if (!activeHub?.child) return;
  await stopActiveHub();
}

export function matchesPublicEventIdentity(
  value: unknown,
  expected: NonNullable<CapturedPublicEventView['confirmedEvent']>,
  depth = 0
): boolean {
  if (!value || typeof value !== 'object' || depth > 5) return false;
  if (Array.isArray(value)) {
    return value.some((entry) => matchesPublicEventIdentity(entry, expected, depth + 1));
  }
  const record = value as Record<string, unknown>;
  const logIndex = record.logIndex ?? record.log_index;
  if (
    record.transactionHash === expected.transactionHash &&
    Number(logIndex) === expected.logIndex &&
    Number(record.blockNumber ?? record.block_number) === expected.blockNumber
  ) {
    return true;
  }
  return Object.values(record).some((entry) => matchesPublicEventIdentity(entry, expected, depth + 1));
}

export async function waitForRepeatedPublicEventDelivery(
  page: Page,
  initialMessageCount: number,
  expected: NonNullable<CapturedPublicEventView['confirmedEvent']>,
  timeoutMs = 20_000,
  pollIntervalMs = 200
): Promise<void> {
  await waitFor(
    async () => {
      const messages = await readPublicEventStreamMessages(page);
      return messages
        .slice(initialMessageCount)
        .find((message) => matchesPublicEventIdentity(message.data, expected)) ?? null;
    },
    Boolean,
    'duplicate indexed public event delivered by the reconnected Hub stream',
    timeoutMs,
    pollIntervalMs
  );
}

export async function repeatCurrentOwnablePublicEventStream(world: PublicEventsWorld) {
  const captured = world.capturedPublicEventView;
  if (!captured?.confirmedEvent) {
    throw new Error('The confirmed public event must be captured before restarting the Hub stream');
  }
  const initialRequestCount = world.__hubRequests?.publicEventStreams.length ?? 0;
  const initialMessageCount = (await readPublicEventStreamMessages(world.page)).length;
  await restartHubForPublicEventReplay(world.page);

  const reconnect = await waitFor(
    async () => {
      const requests = world.__hubRequests?.publicEventStreams ?? [];
      return requests.length > initialRequestCount
        ? [...requests].reverse().find((request) =>
            request.ids.includes(captured.ownableId) &&
            (request.fromBlock === undefined || request.fromBlock <= captured.confirmedEvent!.blockNumber)
          ) ?? null
        : null;
    },
    Boolean,
    'reconnected public-events stream request after Hub restart',
    20_000
  );
  world.latestPublicEventStreamRequest = reconnect;

  await waitForRepeatedPublicEventDelivery(
    world.page,
    initialMessageCount,
    captured.confirmedEvent
  );
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
  const allowedKeys = [idParamName, fromParamName];
  if (
    uniqueKeys.some((key) => !allowedKeys.includes(key)) ||
    !uniqueKeys.includes(idParamName)
  ) {
    throw new Error(
      `Expected repeated ${idParamName} and optional ${fromParamName} query keys but received ${JSON.stringify(uniqueKeys)}`
    );
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
      async () => {
        const record = [...(await trackedPublicEvents(page, ownableId))]
          .reverse()
          .find(
            (candidate) =>
              candidate.status === status &&
              candidate.event.eventType === eventType
          );
        if (!record || (await isProcessingWidgetAction(page))) {
          return null;
        }

        return record;
      },
      Boolean,
      `${status} tracked public event ${eventType}`,
      20_000
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
  await waitFor(
    async () => {
      const records = await trackedPublicEvents(page, ownableId);
      const matches = records.filter((record) => record.event.eventType === eventType);
      if (matches.length !== expectedCount || (await isProcessingWidgetAction(page))) {
        return null;
      }

      return matches;
    },
    Boolean,
    `${expectedCount} tracked public events for ${eventType}`,
    20_000
  );
}

function artifactSafeTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function tailArtifactLog(filename: string, maxLength = 12_000): string | undefined {
  const directory = artifactDirectory();
  if (!directory) return undefined;
  const filePath = path.join(directory, filename);
  if (!existsSync(filePath)) return undefined;
  const contents = readFileSync(filePath, 'utf8');
  return contents.length > maxLength ? contents.slice(-maxLength) : contents;
}

function boundedFailureItems<T>(items: T[], limit = 100): T[] {
  return items.slice(-limit);
}

function runServerDiagnostic(command: string, args: string[]): Record<string, unknown> {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 10_000,
  });
  return {
    command: [command, ...args],
    status: result.status,
    error: result.error?.message,
    stdout: result.stdout?.slice(-12_000),
    stderr: result.stderr?.slice(-12_000),
  };
}

async function rpcDiagnostic(method: string, params: unknown[] = []): Promise<unknown> {
  const rpcUrl = process.env.E2E_RPC_URL?.trim();
  if (!rpcUrl) return { error: 'E2E_RPC_URL is unavailable' };
  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    });
    const payload = await response.json();
    return payload.error ?? payload.result;
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

async function serverFailureDiagnostics(
  confirmedEvent: CapturedPublicEventView['confirmedEvent']
): Promise<Record<string, unknown>> {
  if (testAdapters?.serverFailureDiagnostics) {
    return testAdapters.serverFailureDiagnostics(confirmedEvent);
  }
  const container = process.env.E2E_DATABASE_CONTAINER?.trim();
  const user = process.env.E2E_DATABASE_USER?.trim();
  const database = process.env.E2E_DATABASE_NAME?.trim();
  const databaseDiagnostics = container && user && database
    ? {
        indexedPublicEvents: runServerDiagnostic('docker', [
          'exec', '-i', container, 'psql', '-U', user, '-d', database, '-At', '-c',
          'SELECT row_to_json(event) FROM (SELECT * FROM indexed_public_events ORDER BY block_number DESC, log_index DESC LIMIT 50) event',
        ]),
        indexerCursors: runServerDiagnostic('docker', [
          'exec', '-i', container, 'psql', '-U', user, '-d', database, '-At', '-c',
          'SELECT row_to_json(cursor) FROM (SELECT * FROM indexer_cursors ORDER BY 1 LIMIT 50) cursor',
        ]),
      }
    : { error: 'E2E database coordinates are unavailable' };

  const anchorAddress = process.env.VITE_BASE_SEPOLIA_ANCHOR_ADDRESS?.trim();
  const fromBlock = confirmedEvent?.blockNumber;
  const anchorLogs = anchorAddress && Number.isInteger(fromBlock)
    ? await rpcDiagnostic('eth_getLogs', [{
        address: anchorAddress,
        fromBlock: `0x${fromBlock!.toString(16)}`,
        toBlock: `0x${fromBlock!.toString(16)}`,
      }])
    : { error: 'No confirmed public event block is available for Anchor log diagnostics' };

  return {
    hubHealth: await hubIsHealthy(),
    database: databaseDiagnostics,
    chain: {
      blockNumber: await rpcDiagnostic('eth_blockNumber'),
      anchorLogs,
    },
    logs: {
      hub: tailArtifactLog('hub.log'),
      hubRestarts: tailArtifactLog('hub-restarts.log'),
      setup: tailArtifactLog('setup.log'),
    },
  };
}

export async function capturePublicEventFailure(
  world: PublicEventsWorld,
  failure: unknown
): Promise<void> {
  const directory = artifactDirectory();
  if (!directory || !world.__hubRequests) return;

  try {
    mkdirSync(directory, { recursive: true });
    const suffix = artifactSafeTimestamp();
    const screenshotPath = path.join(directory, `failure-${suffix}.png`);
    const htmlPath = path.join(directory, `failure-${suffix}.html`);
    const reportPath = path.join(directory, `failure-${suffix}.json`);

    const [html, streamMessages] = await Promise.all([
      world.page.content().catch((error) => `<!-- unable to capture HTML: ${String(error)} -->`),
      readPublicEventStreamMessages(world.page).catch(() => []),
      world.page.screenshot({ path: screenshotPath, fullPage: true }).catch((error) => {
        appendHubRestartLog(`Unable to capture failure screenshot: ${String(error)}`);
      }),
    ]);
    writeFileSync(htmlPath, html);

    const ownableId = world.capturedPublicEventView?.ownableId ?? await currentOwnableId(world.page).catch(() => undefined);
    const replay = ownableId
      ? await publicEventDiagnostics(world.page, ownableId).catch((error) => ({ error: String(error) }))
      : { error: 'No current ownable could be resolved' };
    const server = await serverFailureDiagnostics(world.capturedPublicEventView?.confirmedEvent)
      .catch((error) => ({ error: error instanceof Error ? error.message : String(error) }));
    const browser = world.__publicEventBrowserDiagnostics ?? {
      console: [], pageErrors: [], requestFailures: [], streamMessages: [],
    };
    browser.streamMessages = streamMessages;

    writeFileSync(reportPath, `${JSON.stringify({
      failure: String(failure),
      url: world.page.url(),
      screenshot: screenshotPath,
      html: htmlPath,
      runtime: {
        artifactDirectory: directory,
        hubUrl: process.env.E2E_HUB_URL,
        rpcUrl: process.env.E2E_RPC_URL,
        database: process.env.E2E_DATABASE_NAME,
      },
      browser,
      widgetMessages: await world.page.evaluate(() => {
        const win = window as typeof window & { __ownableWidgetMessages?: unknown[] };
        return win.__ownableWidgetMessages ?? [];
      }).catch(() => []),
      hubRequests: {
        publicEventSnapshots: boundedFailureItems(world.__hubRequests.publicEventSnapshots),
        publicEventStreams: boundedFailureItems(world.__hubRequests.publicEventStreams),
      },
      replay,
      server,
    }, null, 2)}\n`);
  } catch (error) {
    console.error(`Unable to retain Story #3 failure diagnostics: ${String(error)}`);
  }
}
