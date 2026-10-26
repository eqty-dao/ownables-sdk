// @vitest-environment jsdom
import { useEffect } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventChain } from "eqty-core";
import EQTYService from "@ownables/adapter-viem/dist/adapter-viem/src/services/EQTY.service.js";
import { OwnableService, PublicEventReplayService } from "@ownables/core";
import { baseSepolia } from "viem/chains";
import { createWalletClient, custom } from "viem";
import { ProgressProvider } from "@/contexts/Progress.context";
import { useOwnableState } from "@/hooks/useOwnableState";

const ADDRESS = "0x0000000000000000000000000000000000000abc" as const;
const ANCHOR_ADDRESS = "0x0000000000000000000000000000000000000001" as const;

const { serviceMap, onError } = vi.hoisted(() => ({
  serviceMap: {} as Record<string, unknown>,
  onError: vi.fn(),
}));

vi.mock("@/hooks/useService", () => ({
  useService: (key: string) => serviceMap[key] ?? null,
}));

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: ADDRESS }),
}));

type PendingRequest = {
  method: string;
  resolve: (value: string) => void;
  reject: (error: Error & { code?: number }) => void;
};

class MemoryIDB {
  private readonly stores = new Map<string, Map<string, unknown>>();

  async hasStore(name: string): Promise<boolean> {
    return this.stores.has(name);
  }

  async createStore(...names: string[]): Promise<void> {
    names.forEach((name) => {
      if (!this.stores.has(name)) this.stores.set(name, new Map());
    });
  }

  async get(store: string, key: string): Promise<unknown> {
    return this.stores.get(store)?.get(key);
  }

  async set(store: string, key: string, value: unknown): Promise<void> {
    if (!this.stores.has(store)) this.stores.set(store, new Map());
    this.stores.get(store)?.set(key, value);
  }

  async keys(store: string): Promise<string[]> {
    return Array.from(this.stores.get(store)?.keys() ?? []);
  }

  async getAll(store: string): Promise<unknown[]> {
    return Array.from(this.stores.get(store)?.values() ?? []);
  }

  async setAll(data: Record<string, unknown>): Promise<void> {
    for (const [store, value] of Object.entries(data)) {
      if (!this.stores.has(store)) this.stores.set(store, new Map());
      const target = this.stores.get(store)!;
      if (value instanceof Map) {
        target.clear();
        value.forEach((entry, key) => target.set(key, entry));
      } else if (value && typeof value === "object") {
        Object.entries(value).forEach(([key, entry]) => target.set(key, entry));
      }
    }
  }

  async delete(store: string, key: string): Promise<void> {
    this.stores.get(store)?.delete(key);
  }
}

function createProvider() {
  const pending: PendingRequest[] = [];
  const provider = {
    request: vi.fn(({ method }: { method: string }) => {
      if (method === "eth_chainId") return Promise.resolve("0x14a34");
      if (method === "eth_accounts") return Promise.resolve([ADDRESS]);
      return new Promise<string>((resolve, reject) => {
        pending.push({ method, resolve, reject });
      });
    }),
  };

  return {
    provider,
    async nextSignature(): Promise<PendingRequest> {
      await waitFor(() => {
        expect(pending.some((request) => request.method === "eth_signTypedData_v4")).toBe(true);
      });
      return pending.splice(
        pending.findIndex((request) => request.method === "eth_signTypedData_v4"),
        1
      )[0];
    },
  };
}

function createOwnableService(provider: ReturnType<typeof createProvider>["provider"], chain: EventChain) {
  const walletClient = createWalletClient({
    account: ADDRESS,
    chain: baseSepolia,
    transport: custom(provider),
  });
  const eqty = new EQTYService(ADDRESS, 84532, walletClient, {} as any, provider, {
    anchor: { contractAddress: ANCHOR_ADDRESS },
    anchorClient: { anchor: async () => undefined },
    logger: { debug() {}, info() {}, warn() {}, error() {} },
  } as any);
  const ownables = new OwnableService({
    stateStore: new MemoryIDB() as any,
    eventChains: {
      anchoring: false,
      getStateDump: async () => [],
      loadAll: async () => [],
    } as any,
    anchorProvider: eqty,
    packages: {} as any,
    runtimeSource: {} as any,
    runtimeRpc: {} as any,
    replay: new PublicEventReplayService(),
  }) as any;
  ownables._rpc.set(chain.id, {
    execute: async () => ({ state: [] }),
    query: async () => ({}),
    setWidgetWindow() {},
    terminate() {},
  });

  return { eqty, ownables };
}

function WidgetHarness({ chain }: { chain: EventChain }) {
  const ownable = useOwnableState(chain, undefined, onError);

  useEffect(() => {
    ownable.iframeRef.current = { contentWindow: window } as HTMLIFrameElement;
  }, [ownable.iframeRef]);

  return null;
}

function dispatchExecute(chain: EventChain) {
  fireEvent(
    window,
    new MessageEvent("message", {
      source: window,
      data: {
        type: "execute",
        ownable_id: chain.id,
        msg: { transfer: { to: "0x0000000000000000000000000000000000000def" } },
      },
    })
  );
}

function status(id: string) {
  return document.querySelector(`[data-progress-step="${id}"]`)?.getAttribute("data-progress-status");
}

describe("provider boundary progress verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(serviceMap).forEach((key) => delete serviceMap[key]);
  });

  afterEach(cleanup);

  it("keeps the widget signing step active through a real EIP-1193 request", async () => {
    const provider = createProvider();
    const chain = EventChain.create(ADDRESS, 84532);
    const { eqty, ownables } = createOwnableService(provider.provider, chain);
    serviceMap.ownables = ownables;
    serviceMap.eventChains = { getStateDump: async () => [] };
    serviceMap.eqty = eqty;

    render(<ProgressProvider><WidgetHarness chain={chain} /></ProgressProvider>);
    await act(async () => dispatchExecute(chain));

    const signature = await provider.nextSignature();
    expect(screen.getByText("Processing action")).not.toBeNull();
    expect(status("signEvent")).toBe("active");
    expect(provider.provider.request).toHaveBeenCalledWith(
      expect.objectContaining({ method: "eth_signTypedData_v4" })
    );

    await act(async () => signature.resolve(`0x${"11".repeat(65)}`));
    await waitFor(() => expect(screen.queryByText("Processing action")).toBeNull());
    expect(onError).not.toHaveBeenCalled();
  });

  it("reports one cancellation after the real provider rejects the signature", async () => {
    const provider = createProvider();
    const chain = EventChain.create(ADDRESS, 84532);
    const { eqty, ownables } = createOwnableService(provider.provider, chain);
    serviceMap.ownables = ownables;
    serviceMap.eventChains = { getStateDump: async () => [] };
    serviceMap.eqty = eqty;

    render(<ProgressProvider><WidgetHarness chain={chain} /></ProgressProvider>);
    await act(async () => dispatchExecute(chain));

    const signature = await provider.nextSignature();
    expect(status("signEvent")).toBe("active");
    await act(async () => signature.reject(Object.assign(new Error("rejected"), { code: 4001 })));

    await waitFor(() => expect(screen.queryByText("Processing action")).toBeNull());
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith("Action cancelled", "Wallet request cancelled");
  });
});
