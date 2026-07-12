import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { EventChain } from "eqty-core";
import { useOwnableState } from "@/hooks/useOwnableState";
import type { TypedPackage } from "@/interfaces/TypedPackage";

const {
  serviceMap,
  progressOpen,
  progressClose,
  accountState,
} = vi.hoisted(() => ({
  serviceMap: {} as Record<string, any>,
  progressOpen: vi.fn(),
  progressClose: vi.fn(),
  accountState: {
    address: "0xabc",
  },
}));

vi.mock("@/hooks/useService", () => ({
  useService: (key: string) => serviceMap[key] ?? null,
}));

vi.mock("@/contexts/Progress.context", () => ({
  useProgress: () => ({
    open: progressOpen,
    close: progressClose,
  }),
}));

vi.mock("wagmi", () => ({
  useAccount: () => accountState,
}));

describe("widget bridge verification", () => {
  let messageHandler: ((event: MessageEvent) => Promise<void>) | undefined;

  beforeEach(() => {
    messageHandler = undefined;
    progressOpen.mockReset();
    progressClose.mockReset();
    accountState.address = "0xabc";

    vi.restoreAllMocks();
    vi.spyOn(window, "addEventListener").mockImplementation(
      ((type: string, listener: EventListenerOrEventListenerObject) => {
        if (type === "message") {
          messageHandler = listener as unknown as (event: MessageEvent) => Promise<void>;
        }
      }) as typeof window.addEventListener
    );
    vi.spyOn(window, "removeEventListener").mockImplementation(
      (() => {}) as typeof window.removeEventListener
    );
  });

  function setupHook({
    archived = false,
    pkg,
    staleStateDump,
    emitReplayStateDump = [],
    onPublicEventsChanged,
    emitPublicEventImpl,
    listTrackedPublicEvents,
  }: {
    archived?: boolean;
    pkg?: TypedPackage;
    staleStateDump?: any;
    emitReplayStateDump?: any;
    onPublicEventsChanged?: (entryId: string, replay: any) => void | Promise<void>;
    emitPublicEventImpl?: (...args: any[]) => Promise<any>;
    listTrackedPublicEvents?: () => Promise<any[]>;
  } = {}) {
    const chain = EventChain.create(
      "0x0000000000000000000000000000000000000abc",
      84532
    );
    const onError = vi.fn();
    const execute = vi.fn().mockResolvedValue([]);
    const defaultEmitReplay = {
      stateDump: emitReplayStateDump,
      appliedEvents: [],
      appliedReplayKeys: [],
      duplicateReplayKeys: [],
      appliedPublicEvents: [],
      duplicatePublicEvents: [],
      complete: true,
      ignoredPublicEvents: [],
      pendingPublicEvents: [
        {
          replayKey: "0xpending:1",
          event: {
            eventType: "drink",
            transactionHash: "0x" + "44".repeat(32),
            logIndex: 1,
            blockNumber: 5,
          },
          status: "pending",
          sources: ["local"],
        },
      ],
      confirmedPendingPublicEvents: [],
    };
    const emitPublicEvent = emitPublicEventImpl
      ? vi.fn(emitPublicEventImpl)
      : vi.fn().mockResolvedValue(defaultEmitReplay);
    const getStateDump = vi.fn().mockResolvedValue(staleStateDump);
    const query = vi.fn(async (msg: Record<string, unknown>, state: any) => {
      if ("get_widget_state" in msg) {
        const stacked =
          state.find?.(([key]: [string, unknown]) => key === "stacked_blocks")?.[1] ?? 1;
        return { stacked_blocks: stacked };
      }
      if ("get_info" in msg) {
        return {
          owner: "0xabc",
          issuer: "0xabc",
          ownable_type: "block_stack",
        };
      }
      if ("get_metadata" in msg) {
        return {
          name: pkg?.title ?? "Block Stack",
          description: pkg?.description ?? "Stack seven crooked public blocks",
        };
      }
      return false;
    });
    const rpc = { query };

    const ctrl = {
      close: progressClose,
      setActive: vi.fn(),
      setDone: vi.fn(),
      setError: vi.fn(),
      updateStep: vi.fn(),
    };
    progressOpen.mockReturnValue([ctrl, vi.fn()]);

    serviceMap.ownables = {
      execute,
      emitPublicEvent,
      listTrackedPublicEvents: listTrackedPublicEvents ?? vi.fn().mockResolvedValue([]),
      isReady: vi.fn().mockReturnValue(true),
      rpc: vi.fn().mockReturnValue(rpc),
      setWidgetWindow: vi.fn(),
      submitAnchors: vi.fn(),
      anchoring: true,
    };
    serviceMap.eventChains = {
      getStateDump,
    };
    serviceMap.eqty = {
      address: "0xabc",
    };

    const render = renderHook(() =>
      useOwnableState(chain, pkg, onError, archived, 0, onPublicEventsChanged)
    );
    const widgetWindow = {
      postMessage: vi.fn(),
    } as unknown as Window;

    act(() => {
      render.result.current.iframeRef.current = {
        contentWindow: widgetWindow,
      } as HTMLIFrameElement;
    });

    if (!messageHandler) {
      throw new Error("Widget message handler was not registered");
    }

    return {
      chain,
      ctrl,
      emitPublicEvent,
      execute,
      getStateDump,
      messageHandler,
      onError,
      query,
      rpc,
      widgetWindow,
    };
  }

  it("keeps execute messages on the private execute path", async () => {
    const { chain, execute, emitPublicEvent, messageHandler, widgetWindow } = setupHook();

    await act(async () => {
      await messageHandler({
        data: {
          type: "execute",
          ownable_id: chain.id,
          msg: { transfer: { to: "0xdef" } },
        },
        source: widgetWindow,
      } as MessageEvent);
    });

    expect(execute).toHaveBeenCalledWith(
      expect.any(EventChain),
      { transfer: { to: "0xdef" } },
      [],
      expect.any(Function),
      []
    );
    expect(emitPublicEvent).not.toHaveBeenCalled();
    expect(progressOpen).toHaveBeenCalledWith({
      title: "Processing action",
      steps: [
        { id: "signEvent", label: "Sign the event" },
        { id: "anchor", label: "Anchor the event" },
      ],
    });
  });

  it("routes emit messages through the public-event flow with the single-key msg envelope", async () => {
    const { chain, execute, emitPublicEvent, messageHandler, widgetWindow } = setupHook();

    await act(async () => {
      await messageHandler({
        data: {
          type: "emit",
          ownable_id: chain.id,
          msg: { drink: { amount: 25 } },
        },
        source: widgetWindow,
      } as MessageEvent);
    });

    expect(execute).not.toHaveBeenCalled();
    expect(emitPublicEvent).toHaveBeenCalledWith(
      expect.any(EventChain),
      "drink",
      { amount: 25 },
      expect.any(Function)
    );
    expect(progressOpen).toHaveBeenCalledWith({
      title: "Processing action",
      steps: [{ id: "emitPublicEvent", label: "Emit the public event" }],
    });
    expect(progressClose).toHaveBeenCalledTimes(1);
  });

  it("rejects archived widget messages before reaching either runtime path", async () => {
    const { chain, execute, emitPublicEvent, messageHandler, onError, widgetWindow } =
      setupHook({ archived: true });

    await act(async () => {
      await messageHandler({
        data: {
          type: "emit",
          ownable_id: chain.id,
          msg: { drink: { amount: 25 } },
        },
        source: widgetWindow,
      } as MessageEvent);
    });

    expect(execute).not.toHaveBeenCalled();
    expect(emitPublicEvent).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(
      "Interaction unavailable",
      "Archived ownables are read-only"
    );
    expect(progressOpen).not.toHaveBeenCalled();
  });

  it("ignores wrong ownable ids and rejects wrong iframe sources", async () => {
    const { chain, execute, emitPublicEvent, messageHandler, widgetWindow } = setupHook();

    await act(async () => {
      await messageHandler({
        data: {
          type: "emit",
          ownable_id: "eip155:84532:0xother",
          msg: { drink: { amount: 25 } },
        },
        source: widgetWindow,
      } as MessageEvent);
    });

    expect(execute).not.toHaveBeenCalled();
    expect(emitPublicEvent).not.toHaveBeenCalled();

    await expect(
      messageHandler({
        data: {
          type: "emit",
          ownable_id: chain.id,
          msg: { drink: { amount: 25 } },
        },
        source: {} as Window,
      } as MessageEvent)
    ).rejects.toThrow("Not allowed to execute msg on other Ownable");
    expect(execute).not.toHaveBeenCalled();
    expect(emitPublicEvent).not.toHaveBeenCalled();
  });

  it("refreshes the widget from the emitted replay state instead of a stale persisted dump", async () => {
    const pkg = {
      title: "Block Stack",
      name: "ownable-block-stack",
      description: "Stack seven crooked public blocks",
      cid: "bafy-test",
      versions: [],
      isDynamic: true,
      hasMetadata: true,
      hasWidgetState: true,
      hasAttachments: false,
      isClosable: false,
      isConsumable: false,
      isConsumer: false,
      isLockable: false,
      isTransferable: false,
    } satisfies TypedPackage;
    const staleStateDump: any = [];
    const replayStateDump: any = [["stacked_blocks", 2]];
    const {
      chain,
      emitPublicEvent,
      messageHandler,
      query,
      widgetWindow,
    } = setupHook({
      pkg,
      staleStateDump,
      emitReplayStateDump: replayStateDump,
    });

    await act(async () => {
      await messageHandler({
        data: {
          type: "emit",
          ownable_id: chain.id,
          msg: { stack: { total_blocks: 2 } },
        },
        source: widgetWindow,
      } as MessageEvent);
    });

    expect(emitPublicEvent).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith({ get_widget_state: {} }, replayStateDump);
    expect((widgetWindow as any).postMessage).toHaveBeenCalledWith(
      { ownable_id: chain.id, state: { stacked_blocks: 2 } },
      "*"
    );
  });

  it("forwards emitted pending replay records to the outer public-event sync callback", async () => {
    const onPublicEventsChanged = vi.fn().mockResolvedValue(undefined);
    const {
      chain,
      emitPublicEvent,
      messageHandler,
      widgetWindow,
    } = setupHook({
      onPublicEventsChanged,
    });

    await act(async () => {
      await messageHandler({
        data: {
          type: "emit",
          ownable_id: chain.id,
          msg: { drink: { amount: 25 } },
        },
        source: widgetWindow,
      } as MessageEvent);
    });

    expect(emitPublicEvent).toHaveBeenCalledTimes(1);
    expect(onPublicEventsChanged).toHaveBeenCalledTimes(1);
    expect(onPublicEventsChanged).toHaveBeenCalledWith(
      chain.id,
      expect.objectContaining({
        pendingPublicEvents: [
          expect.objectContaining({
            status: "pending",
            sources: ["local"],
          }),
        ],
      })
    );
  });

  it("closes the widget progress once a local pending replay record is visible", async () => {
    let resolveEmit!: (value: any) => void;
    const emitPublicEventImpl = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveEmit = resolve;
        })
    );
    const pendingRecord = {
      replayKey: "pending:drink:1",
      event: {
        eventType: "drink",
        transactionHash: "0x" + "55".repeat(32),
        logIndex: 0,
        blockNumber: 0,
      },
      status: "pending",
      sources: ["local"],
    };
    const listTrackedPublicEvents = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValue([pendingRecord]);
    const onPublicEventsChanged = vi.fn().mockResolvedValue(undefined);
    const { chain, messageHandler, widgetWindow } = setupHook({
      onPublicEventsChanged,
      emitPublicEventImpl,
      listTrackedPublicEvents,
    });

    await act(async () => {
      await messageHandler({
        data: {
          type: "emit",
          ownable_id: chain.id,
          msg: { drink: { amount: 25 } },
        },
        source: widgetWindow,
      } as MessageEvent);
    });

    expect(progressClose).toHaveBeenCalledTimes(1);
    expect(onPublicEventsChanged).not.toHaveBeenCalled();

    resolveEmit({
      stateDump: [],
      appliedEvents: [],
      appliedReplayKeys: [],
      duplicateReplayKeys: [],
      appliedPublicEvents: [],
      duplicatePublicEvents: [],
      complete: true,
      ignoredPublicEvents: [],
      pendingPublicEvents: [pendingRecord],
      confirmedPendingPublicEvents: [],
    });

    await vi.waitFor(() => {
      expect(onPublicEventsChanged).toHaveBeenCalledWith(
        chain.id,
        expect.objectContaining({
          pendingPublicEvents: [expect.objectContaining({ status: "pending" })],
        })
      );
    });
  });
});
