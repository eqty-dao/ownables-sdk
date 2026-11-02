import { expect, type Page, type Request as PlaywrightRequest, type Response } from '@playwright/test';
import { loadE2ERuntimeEnvironment } from './e2e-runtime.ts';

loadE2ERuntimeEnvironment();

const RECIPIENT_ADDRESS = '0x70997970c51812dc3a010c7d01b50e0d17dc79c8';
const HUB_ORIGIN = process.env.VITE_HUB?.trim().replace(/\/$/, '') ?? '';
const EVENT_SOURCE_OPEN_URLS_KEY = '__ownablesStory10EventSourceOpenUrls';

interface PendingUpload {
  status: number;
  body: unknown;
}

export interface TransferImportWorld {
  page: Page;
  __transferImportRequestHandler?: (request: PlaywrightRequest) => void;
  __transferImportResponseHandler?: (response: Response) => void;
  __transferImportPendingUploads?: PendingUpload[];
  __transferImportRecipientSnapshots?: number;
  __transferImportRecipientStreams?: number;
  __transferImportSnapshotBaseline?: number;
  __transferImportEventSourceTrackingInstalled?: boolean;
}

async function waitFor<T>(
  getValue: () => Promise<T | null>,
  label: string,
  timeoutMs = 20_000
): Promise<T> {
  const started = Date.now();
  let lastError: unknown;
  while (Date.now() - started < timeoutMs) {
    try {
      const value = await getValue();
      if (value !== null) return value;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error(`${label} timed out${lastError ? `: ${String(lastError)}` : ''}`);
}

function hubPath(url: string): string | null {
  if (!HUB_ORIGIN || !url.startsWith(HUB_ORIGIN)) return null;
  return new URL(url).pathname;
}

function isRecipientDiscoveryPath(pathname: string): boolean {
  return (
    decodeURIComponent(pathname).toLowerCase() ===
    `/accounts/eip155:84532:${RECIPIENT_ADDRESS}/available-ownables`
  );
}

function isRecipientStreamPath(pathname: string): boolean {
  return (
    decodeURIComponent(pathname).toLowerCase() ===
    `/accounts/eip155:84532:${RECIPIENT_ADDRESS}/available-ownables/events`
  );
}

async function installEventSourceOpenTracking(world: TransferImportWorld): Promise<void> {
  if (world.__transferImportEventSourceTrackingInstalled) return;

  await world.page.addInitScript((key: string) => {
    const trackedWindow = window as Window & Record<string, string[]>;
    trackedWindow[key] = [];
    const NativeEventSource = window.EventSource;
    if (!NativeEventSource) return;

    window.EventSource = new Proxy(NativeEventSource, {
      construct(target, args) {
        const source = Reflect.construct(target, args) as EventSource;
        source.addEventListener('open', () => {
          trackedWindow[key].push(String(args[0]));
        });
        return source;
      },
    }) as typeof EventSource;
  }, EVENT_SOURCE_OPEN_URLS_KEY);
  world.__transferImportEventSourceTrackingInstalled = true;
}

export async function resetTransferImportProof(world: TransferImportWorld): Promise<void> {
  if (!HUB_ORIGIN) {
    throw new Error('VITE_HUB is required for the transfer and import proof');
  }

  await installEventSourceOpenTracking(world);

  world.__transferImportPendingUploads = [];
  world.__transferImportRecipientSnapshots = 0;
  world.__transferImportRecipientStreams = 0;
  world.__transferImportSnapshotBaseline = undefined;

  if (world.__transferImportRequestHandler || world.__transferImportResponseHandler) return;

  world.__transferImportRequestHandler = (request) => {
    const pathname = hubPath(request.url());
    if (!pathname || request.method() !== 'GET') return;
    if (isRecipientDiscoveryPath(pathname)) {
      world.__transferImportRecipientSnapshots = (world.__transferImportRecipientSnapshots ?? 0) + 1;
    }
    if (isRecipientStreamPath(pathname)) {
      world.__transferImportRecipientStreams = (world.__transferImportRecipientStreams ?? 0) + 1;
    }
  };
  world.__transferImportResponseHandler = (response) => {
    const pathname = hubPath(response.url());
    if (!pathname || pathname !== '/ownables' || response.request().method() !== 'POST') return;
    void response
      .json()
      .then((body) => world.__transferImportPendingUploads?.push({ status: response.status(), body }))
      .catch(() => world.__transferImportPendingUploads?.push({ status: response.status(), body: null }));
  };
  world.page.on('request', world.__transferImportRequestHandler);
  world.page.on('response', world.__transferImportResponseHandler);
}

export async function expectPendingTransferUpload(world: TransferImportWorld): Promise<void> {
  const upload = await waitFor(
    async () => world.__transferImportPendingUploads?.at(-1) ?? null,
    'pending Hub upload response'
  );
  const body = upload.body as Record<string, unknown> | null;

  expect(upload.status).toBe(202);
  expect(body?.status).toBe('pending');
  expect(body?.ownableId).toEqual(expect.any(String));
  expect((body?.ownableId as string).trim()).not.toBe('');
  expect(body?.expiresAt).toEqual(expect.any(String));
  expect(Number.isNaN(Date.parse(body?.expiresAt as string))).toBe(false);
}

export async function expectRecipientDiscoveryReady(world: TransferImportWorld): Promise<void> {
  await waitFor(
    async () => {
      const eventSourceUrls = await world.page.evaluate((key: string) => {
        const value = (window as Window & Record<string, unknown>)[key];
        return Array.isArray(value) ? value.filter((url): url is string => typeof url === 'string') : [];
      }, EVENT_SOURCE_OPEN_URLS_KEY);
      const recipientStreamOpened = eventSourceUrls.some((url) => {
        try {
          return isRecipientStreamPath(new URL(url).pathname);
        } catch {
          return false;
        }
      });

      return (world.__transferImportRecipientSnapshots ?? 0) > 0 &&
        (world.__transferImportRecipientStreams ?? 0) > 0 &&
        recipientStreamOpened
        ? true
        : null;
    },
    'recipient discovery snapshot and open availability stream'
  );
  world.__transferImportSnapshotBaseline = world.__transferImportRecipientSnapshots;
}

export async function expectAvailableThroughStream(
  world: TransferImportWorld,
  buttonName: string
): Promise<void> {
  const baseline = world.__transferImportSnapshotBaseline;
  if (baseline === undefined) {
    throw new Error('Recipient discovery baseline was not established before Hub indexing');
  }

  await expect(world.page.getByRole('button', { name: buttonName })).toBeVisible({ timeout: 20_000 });
  expect(world.__transferImportRecipientStreams).toBeGreaterThan(0);
  expect(world.__transferImportRecipientSnapshots).toBe(baseline);
}
