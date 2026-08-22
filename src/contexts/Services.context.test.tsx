// @vitest-environment jsdom
import type { ReactNode } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  address: "0xaaa" as string | undefined,
  chainId: 84532,
  walletClient: { id: "wallet-a" } as unknown,
  publicClient: { id: "public-a" } as unknown,
  instances: [] as Array<{
    address: string;
    chainId: number;
    key: string;
    dispose: ReturnType<typeof vi.fn>;
  }>,
}));

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: state.address }),
  useChainId: () => state.chainId,
  useWalletClient: () => ({ data: state.walletClient }),
  usePublicClient: () => state.publicClient,
}));

vi.mock("@/utils/isE2E", () => ({ isE2E: false }));
vi.mock("@/utils/E2EWallet", () => ({
  getE2EAccount: () => ({ address: "0xe2e" }),
}));

vi.mock("@/services/ServiceContainer", () => ({
  default: class MockServiceContainer {
    readonly key: string;
    readonly dispose = vi.fn().mockResolvedValue(undefined);

    constructor(
      readonly address: string,
      readonly chainId: number
    ) {
      this.key = `${address}:${chainId}`;
      state.instances.push(this);
    }
  },
}));

import { ServicesProvider, useContainer } from "./Services.context";

function CurrentContainer() {
  const container = useContainer();
  return <div data-testid="container-key">{container?.key ?? "none"}</div>;
}

function renderProvider(children: ReactNode = <CurrentContainer />) {
  return render(<ServicesProvider>{children}</ServicesProvider>);
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("ServicesProvider lifecycle", () => {
  beforeEach(() => {
    state.address = "0xaaa";
    state.chainId = 84532;
    state.walletClient = { id: "wallet-a" };
    state.publicClient = { id: "public-a" };
    state.instances.length = 0;
  });

  afterEach(cleanup);

  it("keeps the same container when account and network key are unchanged", async () => {
    const view = renderProvider();
    await flushEffects();
    const original = state.instances[0];

    state.walletClient = { id: "wallet-a-refreshed" };
    state.publicClient = { id: "public-a-refreshed" };
    view.rerender(
      <ServicesProvider>
        <CurrentContainer />
      </ServicesProvider>
    );
    await flushEffects();

    expect(state.instances).toEqual([original]);
    expect(original.dispose).not.toHaveBeenCalled();
    expect(screen.getByTestId("container-key").textContent).toBe("0xaaa:84532");
  });

  it("replaces and retires the container when account or network changes", async () => {
    const view = renderProvider();
    await flushEffects();
    const accountContainer = state.instances[0];

    state.address = "0xbbb";
    view.rerender(
      <ServicesProvider>
        <CurrentContainer />
      </ServicesProvider>
    );
    await flushEffects();
    const replacement = state.instances[1];

    expect(accountContainer.dispose).toHaveBeenCalledOnce();
    expect(replacement.key).toBe("0xbbb:84532");

    state.chainId = 8453;
    view.rerender(
      <ServicesProvider>
        <CurrentContainer />
      </ServicesProvider>
    );
    await flushEffects();

    expect(replacement.dispose).toHaveBeenCalledOnce();
    expect(state.instances[2].key).toBe("0xbbb:8453");
  });

  it("retires the current container on disconnect", async () => {
    const view = renderProvider();
    await flushEffects();
    const current = state.instances[0];

    state.address = undefined;
    view.rerender(
      <ServicesProvider>
        <CurrentContainer />
      </ServicesProvider>
    );
    await flushEffects();

    expect(current.dispose).toHaveBeenCalledOnce();
    expect(state.instances).toHaveLength(1);
    expect(screen.getByTestId("container-key").textContent).toBe("none");
  });

  it("suppresses stale A to B replacement when C arrives during retirement", async () => {
    let finishRetirement!: () => void;
    const retirement = new Promise<void>((resolve) => {
      finishRetirement = resolve;
    });
    const view = renderProvider();
    await flushEffects();
    const containerA = state.instances[0];
    containerA.dispose.mockReturnValueOnce(retirement);

    state.address = "0xbbb";
    view.rerender(
      <ServicesProvider>
        <CurrentContainer />
      </ServicesProvider>
    );
    await act(async () => {
      await Promise.resolve();
    });

    state.address = "0xccc";
    view.rerender(
      <ServicesProvider>
        <CurrentContainer />
      </ServicesProvider>
    );
    await flushEffects();

    expect(state.instances.map(({ key }) => key)).toEqual([
      "0xaaa:84532",
      "0xccc:84532",
    ]);
    expect(screen.getByTestId("container-key").textContent).toBe("0xccc:84532");

    finishRetirement();
    await flushEffects();

    expect(containerA.dispose).toHaveBeenCalledOnce();
    expect(state.instances.map(({ key }) => key)).not.toContain("0xbbb:84532");
  });

  it("retires the current container once on unmount", async () => {
    const view = renderProvider();
    await flushEffects();
    const current = state.instances[0];

    view.unmount();
    await flushEffects();

    expect(current.dispose).toHaveBeenCalledOnce();
  });
});
