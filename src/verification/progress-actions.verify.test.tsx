// @vitest-environment jsdom
import { useEffect } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventChain } from "eqty-core";
import { ProgressProvider, useProgress } from "@/contexts/Progress.context";
import { useConsuming } from "@/hooks/useConsuming";
import { useOwnableState } from "@/hooks/useOwnableState";
import { useOwnableTransfer } from "@/hooks/useOwnableTransfer";
import { useOwnables } from "@/hooks/useOwnables";

const { serviceMap, onError, showError, enqueueSnackbar } = vi.hoisted(() => ({
  serviceMap: {} as Record<string, any>,
  onError: vi.fn(),
  showError: vi.fn(),
  enqueueSnackbar: vi.fn(),
}));

vi.mock("@/hooks/useService", () => ({
  useService: (key: string) => serviceMap[key] ?? null,
}));

vi.mock("@/contexts/Dialogs.context", () => ({
  useDialogs: () => ({ showError, showConfirm: vi.fn(), showAlert: vi.fn() }),
}));

vi.mock("@/contexts/Overlay.context", () => ({
  useOverlay: () => ({ show: vi.fn(), hide: vi.fn(), active: false }),
}));

vi.mock("@/hooks/useBreakpoint", () => ({ useBreakpoint: () => false }));
vi.mock("@/hooks/useEffectiveWallet", () => ({
  default: () => ({ address: "0xabc", isConnected: true, isConnecting: false }),
}));
vi.mock("wagmi", () => ({
  useAccount: () => ({ address: "0xabc", isConnected: true }),
  useChainId: () => 84532,
}));
vi.mock("notistack", () => ({ enqueueSnackbar }));

type PendingRequest = {
  method: string;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
};

function createProvider() {
  const pending: PendingRequest[] = [];
  const request = vi.fn(({ method }: { method: string }) => new Promise((resolve, reject) => {
    pending.push({ method, resolve, reject });
  }));

  return {
    request,
    async next(method: string) {
      await waitFor(() => expect(pending.some((entry) => entry.method === method)).toBe(true));
      const index = pending.findIndex((entry) => entry.method === method);
      return pending.splice(index, 1)[0];
    },
  };
}

function stepStatus(stepId: string) {
  return document.querySelector(`[data-progress-step="${stepId}"]`)?.getAttribute("data-progress-status");
}

function chain(id = "0x0000000000000000000000000000000000000abc") {
  return EventChain.create(id, 84532);
}

function publicReplay() {
  return {
    stateDump: [],
    appliedEvents: [],
    appliedReplayKeys: [],
    duplicateReplayKeys: [],
    appliedPublicEvents: [],
    duplicatePublicEvents: [],
    complete: true,
    ignoredPublicEvents: [],
    pendingPublicEvents: [],
    confirmedPendingPublicEvents: [],
  };
}

function walletRejection() {
  return Object.assign(new Error("User rejected the request"), { code: 4001 });
}

const pkg = {
  title: "Test Ownable",
  name: "test-ownable",
  cid: "bafy-test",
  versions: [],
  isDynamic: true,
  hasMetadata: false,
  hasWidgetState: false,
  hasAttachments: false,
  isClosable: false,
  isConsumable: false,
  isConsumer: false,
  isLockable: false,
  isTransferable: true,
};

const emptyOwnables: [] = [];
const onConsumed = vi.fn();

function WidgetHarness({ actionChain, onSynced }: { actionChain: EventChain; onSynced?: () => void }) {
  const ownable = useOwnableState(actionChain, undefined, onError, false, undefined, onSynced);

  useEffect(() => {
    ownable.iframeRef.current = { contentWindow: window } as unknown as HTMLIFrameElement;
  }, [ownable.iframeRef]);

  return null;
}

function ForgeHarness() {
  const { forge } = useOwnables({ onSelect: vi.fn() });
  return <button type="button" onClick={() => void forge(pkg)}>Forge</button>;
}

function ConsumeHarness({ consumer, consumable }: { consumer: EventChain; consumable: EventChain }) {
  const { consume } = useConsuming({ ownables: emptyOwnables, onConsumed });
  return <button type="button" onClick={() => void consume(consumer, consumable)}>Consume</button>;
}

function TransferHarness({ actionChain }: { actionChain: EventChain }) {
  const ownable = useOwnableState(actionChain, undefined, onError);
  const { transfer } = useOwnableTransfer(actionChain, pkg, ownable.execute);
  return <button type="button" onClick={() => void transfer("0xdef")}>Transfer</button>;
}

function NewerAction() {
  const progress = useProgress();
  return (
    <button
      type="button"
      onClick={() => progress.open({ title: "Newer action", steps: [{ id: "newer", label: "Newer" }] })}
    >
      Start newer action
    </button>
  );
}

function dispatchWidget(actionChain: EventChain, type: "emit" | "execute") {
  fireEvent(
    window,
    new MessageEvent("message", {
      source: window,
      data: {
        type,
        ownable_id: actionChain.id,
        msg: type === "emit" ? { drink: { amount: 1 } } : { transfer: { to: "0xdef" } },
      },
    })
  );
}

describe("provider-mediated progress actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(serviceMap).forEach((key) => delete serviceMap[key]);
  });

  afterEach(cleanup);

  it("keeps public emit active through the pending wallet request, then closes once on success or cancellation", async () => {
    const provider = createProvider();
    serviceMap.ownables = {
      anchoring: false,
      isReady: vi.fn().mockReturnValue(true),
      setWidgetWindow: vi.fn(),
      emitPublicEvent: async () => {
        await provider.request({ method: "eth_signTypedData_v4" });
        return publicReplay();
      },
    };

    const actionChain = chain();
    render(<ProgressProvider><WidgetHarness actionChain={actionChain} /></ProgressProvider>);

    await act(async () => {
      dispatchWidget(actionChain, "emit");
    });
    const approval = await provider.next("eth_signTypedData_v4");
    expect(screen.getByText("Processing action")).not.toBeNull();
    expect(stepStatus("emitPublicEvent")).toBe("active");

    await act(async () => approval.resolve("0xsigned"));
    await waitFor(() => expect(screen.queryByText("Processing action")).toBeNull());

    await act(async () => {
      dispatchWidget(actionChain, "emit");
    });
    const rejection = await provider.next("eth_signTypedData_v4");
    expect(stepStatus("emitPublicEvent")).toBe("active");

    await act(async () => rejection.reject(walletRejection()));
    await waitFor(() => expect(screen.queryByText("Processing action")).toBeNull());
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith("Action cancelled", "Wallet request cancelled");
  });

  it("shows widget execute sign and anchor states across successive provider requests", async () => {
    const provider = createProvider();
    serviceMap.ownables = {
      anchoring: true,
      isReady: vi.fn().mockReturnValue(true),
      setWidgetWindow: vi.fn(),
      execute: async (_chain: EventChain, _msg: unknown, _state: unknown, onProgress: any) => {
        await provider.request({ method: "eth_signTypedData_v4" });
        onProgress("signEvent", { signature: "0xsigned" });
        return [];
      },
      submitAnchors: async (onProgress: any) => {
        await provider.request({ method: "eth_sendTransaction" });
        onProgress("anchor", { hash: "0xanchor" });
      },
    };

    const actionChain = chain();
    render(<ProgressProvider><WidgetHarness actionChain={actionChain} /></ProgressProvider>);
    await act(async () => {
      dispatchWidget(actionChain, "execute");
    });

    const signature = await provider.next("eth_signTypedData_v4");
    expect(stepStatus("signEvent")).toBe("active");
    expect(stepStatus("anchor")).toBe("pending");

    await act(async () => signature.resolve("0xsigned"));
    const anchor = await provider.next("eth_sendTransaction");
    expect(stepStatus("signEvent")).toBe("done");
    expect(stepStatus("anchor")).toBe("active");
    await act(async () => anchor.resolve("0xanchor"));
    await waitFor(() => expect(screen.queryByText("Processing action")).toBeNull());
  });

  it("drives forge, consume, and transfer through their real action hooks", async () => {
    const provider = createProvider();
    const forgedChain = chain("0x0000000000000000000000000000000000000def");
    serviceMap.ownables = {
      anchoring: true,
      loadAll: vi.fn().mockResolvedValue([]),
      setWidgetWindow: vi.fn(),
      create: async (_pkg: unknown, onProgress: any) => {
        await provider.request({ method: "eth_signTypedData_v4" });
        onProgress("signEvent", {});
        await provider.request({ method: "eth_sendTransaction" });
        onProgress("anchorEvent", {});
        return { chain: forgedChain };
      },
      init: vi.fn().mockResolvedValue(undefined),
      consume: async (_consumer: EventChain, _consumable: EventChain, onProgress: any) => {
        await provider.request({ method: "eth_signTypedData_v4" });
        onProgress("signConsumableEvent", {});
        await provider.request({ method: "eth_signTypedData_v4" });
        onProgress("signConsumerEvent", {});
        await provider.request({ method: "eth_sendTransaction" });
        onProgress("anchor", {});
      },
      execute: async (_chain: EventChain, _msg: unknown, _state: unknown, onProgress: any) => {
        await provider.request({ method: "eth_signTypedData_v4" });
        onProgress("signEvent", {});
        return [];
      },
      submitAnchors: async (onProgress: any) => {
        await provider.request({ method: "eth_sendTransaction" });
        onProgress("anchor", {});
      },
      zip: vi.fn().mockResolvedValue({ generateAsync: vi.fn().mockResolvedValue(new Uint8Array()) }),
    };
    serviceMap.hub = {
      isAvailable: vi.fn().mockResolvedValue(true),
      uploadOwnable: vi.fn(async (_content: Uint8Array, _name: string, onProgress: any) => onProgress("hubUpload", {})),
    };

    const { unmount } = render(<ProgressProvider><ForgeHarness /></ProgressProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Forge" }));
    const forgeSign = await provider.next("eth_signTypedData_v4");
    expect(stepStatus("signEvent")).toBe("active");
    await act(async () => forgeSign.resolve("0xsigned"));
    const forgeAnchor = await provider.next("eth_sendTransaction");
    expect(stepStatus("signEvent")).toBe("done");
    expect(stepStatus("anchorEvent")).toBe("active");
    await act(async () => forgeAnchor.resolve("0xanchor"));
    await waitFor(() => expect(screen.queryByText("Forging Test Ownable")).toBeNull());
    unmount();

    const consumer = chain("0x0000000000000000000000000000000000000c01");
    const consumable = chain("0x0000000000000000000000000000000000000c02");
    const consumeRender = render(<ProgressProvider><ConsumeHarness consumer={consumer} consumable={consumable} /></ProgressProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Consume" }));
    const firstConsumeSignature = await provider.next("eth_signTypedData_v4");
    expect(stepStatus("signConsumableEvent")).toBe("active");
    await act(async () => firstConsumeSignature.resolve("0xfirst"));
    const secondConsumeSignature = await provider.next("eth_signTypedData_v4");
    expect(stepStatus("signConsumableEvent")).toBe("done");
    expect(stepStatus("signConsumerEvent")).toBe("active");
    await act(async () => secondConsumeSignature.resolve("0xsecond"));
    const consumeAnchor = await provider.next("eth_sendTransaction");
    expect(stepStatus("signConsumerEvent")).toBe("done");
    expect(stepStatus("anchor")).toBe("active");
    await act(async () => consumeAnchor.resolve("0xanchor"));
    await waitFor(() => expect(screen.queryByText("Consuming Ownable")).toBeNull());
    consumeRender.unmount();

    const transferChain = chain("0x0000000000000000000000000000000000000c03");
    render(<ProgressProvider><TransferHarness actionChain={transferChain} /></ProgressProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Transfer" }));
    const transferSignature = await provider.next("eth_signTypedData_v4");
    expect(stepStatus("signEvent")).toBe("active");
    await act(async () => transferSignature.resolve("0xtransfer"));
    const transferAnchor = await provider.next("eth_sendTransaction");
    expect(stepStatus("signEvent")).toBe("done");
    expect(stepStatus("hubUpload")).toBe("done");
    expect(stepStatus("anchor")).toBe("active");
    await act(async () => transferAnchor.resolve("0xanchor"));
    await waitFor(() => expect(screen.queryByText("Transferring Ownable")).toBeNull());
  });

  it("reports one cancellation and no success for rejected forge, consume, and transfer requests", async () => {
    const consumer = chain("0x0000000000000000000000000000000000000c11");
    const consumable = chain("0x0000000000000000000000000000000000000c12");
    const transferChain = chain("0x0000000000000000000000000000000000000c13");
    const cases = [
      {
        button: "Forge",
        expected: "Forge cancelled",
        configure(provider: ReturnType<typeof createProvider>) {
          serviceMap.ownables = {
            anchoring: false,
            loadAll: vi.fn().mockResolvedValue([]),
            create: () => provider.request({ method: "eth_signTypedData_v4" }),
          };
        },
        render: () => render(<ProgressProvider><ForgeHarness /></ProgressProvider>),
      },
      {
        button: "Consume",
        expected: "Consume cancelled",
        configure(provider: ReturnType<typeof createProvider>) {
          serviceMap.ownables = {
            anchoring: false,
            consume: () => provider.request({ method: "eth_signTypedData_v4" }),
          };
        },
        render: () => render(
          <ProgressProvider><ConsumeHarness consumer={consumer} consumable={consumable} /></ProgressProvider>
        ),
      },
      {
        button: "Transfer",
        expected: "Transfer cancelled",
        configure(provider: ReturnType<typeof createProvider>) {
          serviceMap.ownables = {
            anchoring: false,
            isReady: vi.fn().mockReturnValue(true),
            setWidgetWindow: vi.fn(),
            execute: () => provider.request({ method: "eth_signTypedData_v4" }),
            zip: vi.fn(),
          };
          serviceMap.hub = { isAvailable: vi.fn().mockResolvedValue(true) };
        },
        render: () => render(<ProgressProvider><TransferHarness actionChain={transferChain} /></ProgressProvider>),
      },
    ];

    for (const action of cases) {
      vi.clearAllMocks();
      Object.keys(serviceMap).forEach((key) => delete serviceMap[key]);
      const provider = createProvider();
      action.configure(provider);
      const view = action.render();
      fireEvent.click(screen.getByRole("button", { name: action.button }));
      const request = await provider.next("eth_signTypedData_v4");
      expect(stepStatus("signEvent") ?? stepStatus("signConsumableEvent")).toBe("active");

      await act(async () => request.reject(walletRejection()));
      await waitFor(() => expect(screen.queryByText(/Forging|Consuming|Transferring/)).toBeNull());
      expect(enqueueSnackbar).toHaveBeenCalledTimes(1);
      expect(enqueueSnackbar).toHaveBeenCalledWith(action.expected, { variant: "info" });
      expect(enqueueSnackbar.mock.calls.map(([message]) => message)).not.toContain("Consumed");
      expect(enqueueSnackbar.mock.calls.map(([message]) => message)).not.toContain("Ownable transferred through Hub");
      view.unmount();
    }
  });

  it("reports one transfer runtime error after an approved wallet request and never reports success", async () => {
    const provider = createProvider();
    const actionChain = chain("0x0000000000000000000000000000000000000c14");
    serviceMap.ownables = {
      anchoring: false,
      isReady: vi.fn().mockReturnValue(true),
      setWidgetWindow: vi.fn(),
      execute: async (_chain: EventChain, _msg: unknown, _state: unknown, onProgress: any) => {
        await provider.request({ method: "eth_signTypedData_v4" });
        onProgress("signEvent", {});
        return [];
      },
      zip: vi.fn().mockResolvedValue({ generateAsync: vi.fn().mockResolvedValue(new Uint8Array()) }),
    };
    serviceMap.hub = {
      isAvailable: vi.fn().mockResolvedValue(true),
      uploadOwnable: vi.fn().mockRejectedValue(new Error("Hub upload failed")),
    };

    render(<ProgressProvider><TransferHarness actionChain={actionChain} /></ProgressProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Transfer" }));
    const request = await provider.next("eth_signTypedData_v4");
    expect(stepStatus("signEvent")).toBe("active");
    await act(async () => request.resolve("0xsigned"));

    await waitFor(() => expect(screen.queryByText("Transferring Ownable")).toBeNull());
    expect(enqueueSnackbar).toHaveBeenCalledTimes(1);
    expect(enqueueSnackbar).toHaveBeenCalledWith("Transfer failed: Hub upload failed", { variant: "error" });
    expect(enqueueSnackbar.mock.calls.map(([message]) => message)).not.toContain("Ownable transferred through Hub");
  });

  it("prevents stale provider completion after overlap or unmount from closing the current modal", async () => {
    const provider = createProvider();
    const synced = vi.fn();
    serviceMap.ownables = {
      anchoring: false,
      isReady: vi.fn().mockReturnValue(true),
      setWidgetWindow: vi.fn(),
      emitPublicEvent: async () => {
        await provider.request({ method: "eth_signTypedData_v4" });
        return publicReplay();
      },
      execute: async () => {
        await provider.request({ method: "eth_signTypedData_v4" });
        return [];
      },
      submitAnchors: vi.fn(),
    };

    const actionChain = chain();
    const view = render(
      <ProgressProvider>
        <WidgetHarness actionChain={actionChain} onSynced={synced} />
        <NewerAction />
      </ProgressProvider>
    );
    await act(async () => dispatchWidget(actionChain, "emit"));
    const older = await provider.next("eth_signTypedData_v4");
    await act(async () => dispatchWidget(actionChain, "execute"));
    const newer = await provider.next("eth_signTypedData_v4");
    expect(stepStatus("signEvent")).toBe("active");

    await act(async () => older.resolve("0xolder"));
    expect(stepStatus("signEvent")).toBe("active");
    expect(synced).not.toHaveBeenCalled();
    await act(async () => newer.resolve("0xnewer"));
    await waitFor(() => expect(screen.queryByText("Processing action")).toBeNull());

    await act(async () => dispatchWidget(actionChain, "emit"));
    const unmounted = await provider.next("eth_signTypedData_v4");
    view.rerender(<ProgressProvider><NewerAction /></ProgressProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Start newer action" }));
    await act(async () => unmounted.resolve("0xlate"));
    expect(screen.getByText("Newer action")).not.toBeNull();
    expect(stepStatus("newer")).toBe("active");
    expect(synced).not.toHaveBeenCalled();
  });
});
