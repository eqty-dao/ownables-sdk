import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { EventChain } from "eqty-core";
import { useOwnables } from "@/hooks/useOwnables";

const { serviceMap, handlers } = vi.hoisted(() => ({
  serviceMap: {} as Record<string, any>,
  handlers: {
    publicEvents: undefined as undefined | ((message: any) => Promise<void>),
  },
}));

vi.mock("@/hooks/useService", () => ({
  useService: (key: string) => serviceMap[key] ?? null,
}));

vi.mock("@/hooks/useEffectiveWallet", () => ({
  default: () => ({
    address: "0xabc",
    isConnected: true,
    isConnecting: false,
  }),
}));

vi.mock("@/contexts/Progress.context", () => ({
  useProgress: () => ({ open: vi.fn() }),
}));

vi.mock("@/contexts/Dialogs.context", () => ({
  useDialogs: () => ({
    showAlert: vi.fn(),
    showConfirm: vi.fn(),
    showError: vi.fn(),
  }),
}));

vi.mock("wagmi", () => ({
  useChainId: () => 84532,
}));

const CHAIN = EventChain.create("0x0000000000000000000000000000000000000abc", 84532);
const PENDING_EVENT = {
  replayKey: "0x" + "44".repeat(32) + ":1",
  event: {
    source: "0x0000000000000000000000000000000000000abc",
    eventType: "drink",
    data: "0x0102",
    transactionHash: "0x" + "44".repeat(32),
    transactionIndex: 0,
    logIndex: 1,
    blockNumber: 5,
  },
  status: "pending" as const,
  sources: ["local" as const],
  localApplicationState: "applied" as const,
  registerEventHash: "register-event",
};
const CONFIRMED_EVENT = {
  ...PENDING_EVENT,
  status: "confirmed" as const,
  sources: ["local" as const, "snapshot" as const, "stream" as const],
};

function configureServices() {
  let trackedEvents: Array<typeof PENDING_EVENT | typeof CONFIRMED_EVENT> = [PENDING_EVENT];

  serviceMap.localStorage = { get: vi.fn(), set: vi.fn(), remove: vi.fn() };
  serviceMap.relay = { removeOwnable: vi.fn() };
  serviceMap.idb = { deleteAllDatabases: vi.fn() };
  serviceMap.packages = { info: vi.fn(() => ({ title: "Potion" })) };
  serviceMap.ownables = {
    loadAll: vi.fn().mockResolvedValue([{ chain: CHAIN, package: "bafy" }]),
    initWorker: vi.fn().mockResolvedValue(undefined),
    listTrackedPublicEvents: vi.fn(async () => trackedEvents),
    applyIndexedPublicEventSnapshot: vi.fn().mockResolvedValue({
      stateDump: [],
      appliedEvents: [],
      appliedReplayKeys: [],
      duplicateReplayKeys: [],
      appliedPublicEvents: [],
      duplicatePublicEvents: [],
      ignoredPublicEvents: [],
      pendingPublicEvents: [PENDING_EVENT],
      confirmedPendingPublicEvents: [],
      complete: true,
    }),
    applyIndexedPublicEventStream: vi.fn().mockImplementation(async () => {
      trackedEvents = [CONFIRMED_EVENT];
      return {
        stateDump: [],
        appliedEvents: [],
        appliedReplayKeys: [],
        duplicateReplayKeys: [CONFIRMED_EVENT.replayKey],
        appliedPublicEvents: [],
        duplicatePublicEvents: [CONFIRMED_EVENT],
        ignoredPublicEvents: [],
        pendingPublicEvents: [],
        confirmedPendingPublicEvents: [CONFIRMED_EVENT],
        complete: true,
      };
    }),
    clearRpc: vi.fn(),
    delete: vi.fn(),
    deleteAll: vi.fn(),
    anchoring: false,
  };
  serviceMap.hub = {
    isConfigured: true,
    listAvailableOwnables: vi.fn().mockResolvedValue({ entries: [] }),
    watchAvailableOwnables: vi.fn(() => ({ close: vi.fn() })),
    loadOwnablePublicEvents: vi.fn().mockResolvedValue({
      ownableId: CHAIN.id,
      publicEvents: [],
    }),
    watchOwnablePublicEvents: vi.fn((_ids: string[], streamHandlers: any) => {
      handlers.publicEvents = streamHandlers.onEvent;
      return { close: vi.fn() };
    }),
  };

  return {
    setTrackedEvents: (events: typeof trackedEvents) => {
      trackedEvents = events;
    },
  };
}

describe("public-event projection verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    handlers.publicEvents = undefined;
    Object.keys(serviceMap).forEach((key) => delete serviceMap[key]);
  });

  afterEach(() => {
    cleanup();
  });

  it("replaces each Ownable's tracked projection after local, snapshot, and stream replay", async () => {
    const { setTrackedEvents } = configureServices();
    const { result } = renderHook(() => useOwnables({ onSelect: vi.fn() }));

    await waitFor(() => {
      expect(result.current.trackedPublicEventsByOwnableId[CHAIN.id]).toEqual([PENDING_EVENT]);
      expect(handlers.publicEvents).toEqual(expect.any(Function));
    });

    setTrackedEvents([CONFIRMED_EVENT]);
    await act(async () => {
      await result.current.notifyOwnablePublicEventsChanged(CHAIN.id, {
        stateDump: [],
        appliedEvents: [],
        appliedReplayKeys: [],
        duplicateReplayKeys: [],
        appliedPublicEvents: [],
        duplicatePublicEvents: [],
        ignoredPublicEvents: [],
        pendingPublicEvents: [PENDING_EVENT],
        confirmedPendingPublicEvents: [],
        complete: true,
      });
    });
    expect(result.current.trackedPublicEventsByOwnableId[CHAIN.id]).toEqual([CONFIRMED_EVENT]);

    await act(async () => {
      await handlers.publicEvents?.({ ownableId: CHAIN.id, publicEvent: CONFIRMED_EVENT.event });
      await handlers.publicEvents?.({ ownableId: CHAIN.id, publicEvent: CONFIRMED_EVENT.event });
    });

    expect(result.current.trackedPublicEventsByOwnableId[CHAIN.id]).toEqual([CONFIRMED_EVENT]);
    expect(serviceMap.ownables.listTrackedPublicEvents).toHaveBeenCalledTimes(4);
    expect(serviceMap.ownables.applyIndexedPublicEventStream).toHaveBeenCalledTimes(2);
  });
});
