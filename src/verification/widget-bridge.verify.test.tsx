import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { EventChain } from "eqty-core";
import { useOwnableState } from "@/hooks/useOwnableState";

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

  function setupHook({ archived = false }: { archived?: boolean } = {}) {
    const chain = EventChain.create(
      "0x0000000000000000000000000000000000000abc",
      84532
    );
    const onError = vi.fn();
    const execute = vi.fn().mockResolvedValue([]);
    const emitPublicEvent = vi.fn().mockResolvedValue({
      stateDump: [],
      appliedEvents: [],
      appliedReplayKeys: [],
      duplicateReplayKeys: [],
      appliedPublicEvents: [],
      duplicatePublicEvents: [],
      complete: true,
      ignoredPublicEvents: [],
    });
    const getStateDump = vi.fn().mockResolvedValue(undefined);

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
      useOwnableState(chain, undefined, onError, archived)
    );
    const widgetWindow = {} as Window;

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
      steps: [
        { id: "encodePublicEvent", label: "Encode the public event" },
        { id: "emitPublicEvent", label: "Emit the public event" },
        { id: "signPublicEvent", label: "Register the public event" },
      ],
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
});
