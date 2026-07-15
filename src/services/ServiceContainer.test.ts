// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@ownables/adapter-viem", () => ({ EQTYService: class {} }));
vi.mock("@ownables/builder", () => ({ BuilderService: class {} }));
vi.mock("@ownables/core", () => ({
  AnchorValidationService: class {},
  EventChainService: class {},
  OwnablePackageCidService: class {},
  OwnableService: class {},
  PollingService: class {},
  PublicEventReplayService: class {},
}));
vi.mock("@ownables/platform-browser", () => ({
  BrowserRuntimeRpcProvider: class {},
  BrowserRuntimeSourceProvider: class {},
  HubService: class {},
  IDBService: class {},
  LocalStorageService: class {},
  PackageService: class {},
  RelayService: class {
    static clearWalletAuth() {}
  },
}));
import ServiceContainer from "./ServiceContainer";

type MutableContainer = {
  cache: Map<string, Promise<unknown>>;
  factories: Map<string, (container: MutableContainer) => unknown>;
  resources: Array<{ close(): void | Promise<void> }>;
  ownResource<T extends { close(): void | Promise<void> }>(resource: T): T;
  get(key: any): Promise<any>;
  dispose(): Promise<void>;
};

function testContainer() {
  const container = new ServiceContainer("0xabc", 84532) as unknown as MutableContainer;
  container.cache.clear();
  container.factories.clear();
  return container;
}

describe("ServiceContainer lifecycle", () => {
  beforeEach(() => localStorage.clear());

  it("constructs lazily once and evicts a failed resolution", async () => {
    const container = testContainer();
    const factory = vi.fn().mockRejectedValueOnce(new Error("retry")).mockResolvedValue({});
    container.factories.set("hub", factory);

    await expect(container.get("hub")).rejects.toThrow("retry");
    await container.get("hub");
    await container.get("hub");

    expect(factory).toHaveBeenCalledTimes(2);
  });

  it("disposes successful resources once in reverse construction order", async () => {
    const container = testContainer();
    const closed: string[] = [];
    for (const name of ["first", "second"]) {
      container.ownResource({ close: vi.fn(() => { closed.push(name); }) });
    }

    await Promise.all([container.dispose(), container.dispose()]);

    expect(closed).toEqual(["second", "first"]);
    await expect(container.get("hub")).rejects.toThrow("disposing or disposed");
  });

  it("cleans partial resources when downstream construction fails", async () => {
    const container = testContainer();
    const close = vi.fn();
    container.factories.set("idb", (current) =>
      current.ownResource({ close })
    );
    container.factories.set("hub", async (current) => {
      await current.get("idb");
      throw new Error("downstream failed");
    });

    await expect(container.get("hub")).rejects.toThrow("downstream failed");
    expect(close).toHaveBeenCalledOnce();
    await expect(container.get("idb")).rejects.toThrow("disposing or disposed");
  });

  it("continues closing resources after one close rejects", async () => {
    const container = testContainer();
    const finalClose = vi.fn();
    container.ownResource({ close: finalClose });
    container.ownResource({ close: () => Promise.reject(new Error("close failed")) });

    await expect(container.dispose()).rejects.toThrow("Failed to dispose");
    expect(finalClose).toHaveBeenCalledOnce();
  });
});
