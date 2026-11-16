import { EventEmitter } from 'node:events';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChildProcess } from 'node:child_process';
import type { Page } from '@playwright/test';
import {
  capturePublicEventFailure,
  configurePublicEventHarnessForTest,
  matchesPublicEventIdentity,
  restartHubForPublicEventReplay,
  stopActiveReplacementHub,
  waitForRepeatedPublicEventDelivery,
  type PublicEventsWorld,
} from './public-events-harness.ts';

const event = {
  transactionHash: '0xabc',
  logIndex: 4,
  blockNumber: 123,
};

const originalEnvironment = {
  artifactDirectory: process.env.E2E_ARTIFACT_DIR,
  hubProcessId: process.env.E2E_HUB_PROCESS_ID,
  hubRuntime: process.env.E2E_HUB_RUNTIME_ENV_JSON,
  hubUrl: process.env.VITE_HUB,
};

afterEach(async () => {
  await stopActiveReplacementHub();
  configurePublicEventHarnessForTest();
  restoreEnvironment('E2E_ARTIFACT_DIR', originalEnvironment.artifactDirectory);
  restoreEnvironment('E2E_HUB_PROCESS_ID', originalEnvironment.hubProcessId);
  restoreEnvironment('E2E_HUB_RUNTIME_ENV_JSON', originalEnvironment.hubRuntime);
  restoreEnvironment('VITE_HUB', originalEnvironment.hubUrl);
});

function restoreEnvironment(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }
  process.env[key] = value;
}

function replacementHub(processId: number, stop: (processId: number) => void): ChildProcess {
  const child = new EventEmitter() as unknown as ChildProcess;
  Object.assign(child, { exitCode: null, pid: processId, signalCode: null });
  child.kill = vi.fn(() => {
    stop(processId);
    Object.assign(child, { exitCode: 0 });
    child.emit('exit', 0, null);
    return true;
  });
  return child;
}

describe('public-event stream duplicate identity', () => {
  it('recognizes the indexed event when Hub SSE wraps it in a delivery envelope', () => {
    expect(matchesPublicEventIdentity({ type: 'public-event', event }, event)).toBe(true);
  });

  it('does not treat a different stream event as duplicate delivery evidence', () => {
    expect(matchesPublicEventIdentity({ event: { ...event, logIndex: 5 } }, event)).toBe(false);
  });

  it('waits for a repeated indexed event instead of accepting reconnect alone', async () => {
    let reads = 0;
    const page = {
      evaluate: vi.fn(async () => {
        reads += 1;
        return reads > 1 ? [{ url: 'http://hub/public-events', data: { event } }] : [];
      }),
    } as unknown as Page;

    await expect(waitForRepeatedPublicEventDelivery(page, 0, event, 100, 1)).resolves.toBeUndefined();
  });

  it('rejects when reconnect produces no repeated indexed event', async () => {
    const page = {
      evaluate: vi.fn(async () => [{ url: 'http://hub/public-events', data: { type: 'connected' } }]),
    } as unknown as Page;

    await expect(waitForRepeatedPublicEventDelivery(page, 0, event, 25, 1)).rejects.toThrow(
      'duplicate indexed public event delivered by the reconnected Hub stream'
    );
  });
});

describe('replacement Hub lifecycle', () => {
  it('restarts after listener closure even if the setup PID remains observable, then cleans up both replacements', async () => {
    process.env.E2E_HUB_PROCESS_ID = '7001';
    process.env.E2E_HUB_RUNTIME_ENV_JSON = '{}';
    process.env.VITE_HUB = 'http://127.0.0.1:3311';
    const listening = new Set([7001]);
    const staleSetupProcesses = new Set([7001]);
    const stopped: number[] = [];
    const firstReplacement = replacementHub(7002, (processId) => listening.delete(processId));
    const finalReplacement = replacementHub(7003, (processId) => listening.delete(processId));
    const nextHub = [firstReplacement, finalReplacement];
    configurePublicEventHarnessForTest({
      createReplacementHub: () => {
        const hub = nextHub.shift();
        if (!hub?.pid) throw new Error('No replacement Hub prepared');
        listening.add(hub.pid);
        return hub;
      },
      hubIsHealthy: async () => listening.size > 0,
      hubListenerIsOpen: async () => listening.size > 0,
      killProcess: (processId) => {
        stopped.push(processId);
        listening.delete(processId);
      },
    });

    await restartHubForPublicEventReplay();
    await restartHubForPublicEventReplay();
    await stopActiveReplacementHub();

    expect(stopped).toEqual([7001]);
    expect(staleSetupProcesses).toContain(7001);
    expect(firstReplacement.kill).toHaveBeenCalledWith('SIGTERM');
    expect(finalReplacement.kill).toHaveBeenCalledWith('SIGTERM');
    expect(nextHub).toHaveLength(0);
    expect(listening.size).toBe(0);
  });
});

describe('public-event failure bundle', () => {
  it('retains the original scenario failure when server diagnostics fail', async () => {
    const artifactDirectory = mkdtempSync(path.join(tmpdir(), 'ownables-story3-failure-'));
    process.env.E2E_ARTIFACT_DIR = artifactDirectory;
    const page = {
      content: vi.fn(async () => '<html><body>failure</body></html>'),
      evaluate: vi.fn(async () => []),
      screenshot: vi.fn(async ({ path: screenshotPath }: { path: string }) => {
        writeFileSync(screenshotPath, 'screenshot');
      }),
      url: vi.fn(() => 'http://127.0.0.1:3300'),
    } as unknown as Page;
    const world = {
      page,
      __hubRequests: {
        publicEventSnapshots: Array.from({ length: 101 }, (_, index) => ({
          ownableId: `ownable-${index}`,
        })),
        publicEventStreams: [],
      },
      capturedPublicEventView: {
        ownableId: 'ownable-id',
        widgetId: 'widget-id',
        url: 'http://127.0.0.1:3300',
        rowTestIds: ['public-event-0'],
        confirmedEvent: event,
      },
    } as PublicEventsWorld;
    configurePublicEventHarnessForTest({
      serverFailureDiagnostics: async () => {
        throw new Error('PostgreSQL and RPC diagnostics unavailable');
      },
    });

    try {
      await capturePublicEventFailure(world, 'original scenario failure');

      const report = readdirSync(artifactDirectory).find((filename) => filename.endsWith('.json'));
      expect(report).toBeDefined();
      const contents = JSON.parse(readFileSync(path.join(artifactDirectory, report!), 'utf8'));
      expect(contents.failure).toBe('original scenario failure');
      expect(contents.server.error).toContain('PostgreSQL and RPC diagnostics unavailable');
      expect(contents.hubRequests.publicEventSnapshots).toHaveLength(100);
      expect(contents.hubRequests.publicEventSnapshots[0].ownableId).toBe('ownable-1');
      expect(readdirSync(artifactDirectory).some((filename) => filename.endsWith('.png'))).toBe(true);
      expect(readdirSync(artifactDirectory).some((filename) => filename.endsWith('.html'))).toBe(true);
    } finally {
      rmSync(artifactDirectory, { recursive: true, force: true });
    }
  });
});
