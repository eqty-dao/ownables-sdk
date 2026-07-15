// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { clearWalletAuth } = vi.hoisted(() => ({
  clearWalletAuth: vi.fn(),
}));
vi.mock("@ownables/adapter-viem", () => ({ EQTYService: class {} }));
vi.mock("@ownables/builder", () => ({ BuilderService: class {} }));
vi.mock("@ownables/core", () => ({
  AnchorValidationService: class {},
  EventChainService: class {},
  OwnableService: class {},
  PollingService: class {},
  PublicEventReplayService: class {},
}));
vi.mock("@ownables/platform-browser", () => ({
  BrowserRuntimeRpcProvider: class {},
  BrowserRuntimeSourceProvider: class {},
  HubService: class {},
  IDBService: class {
    static async packages() {
      return { close() {} };
    }
    static async main() {
      return { close() {} };
    }
  },
  LocalStorageService: class {},
  PackageService: class {},
  RelayService: class {
    static clearWalletAuth = clearWalletAuth;
  },
}));
import ServiceContainer, { type ServiceKey } from "./ServiceContainer";
import { PackageService } from "@ownables/platform-browser";

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
  beforeEach(() => {
    localStorage.clear();
    clearWalletAuth.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resolves packages without a package CID service entry", async () => {
    const container = new ServiceContainer("0xabc", 84532);

    expect(container.has("packageCid" as ServiceKey)).toBe(false);
    await expect(container.get("packages")).resolves.toBeInstanceOf(
      PackageService
    );
  });

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

  it("retires relay authentication through disposal without closing caller-owned streams", async () => {
    const container = testContainer();
    const closeStream = vi.fn();
    container.factories.set("hub", () => ({ close: closeStream }));
    await container.get("hub");

    await container.dispose();

    expect(clearWalletAuth).toHaveBeenCalledOnce();
    expect(clearWalletAuth).toHaveBeenCalledWith("0xabc", 84532, localStorage);
    expect(closeStream).not.toHaveBeenCalled();
  });

  it("disposes resources without browser storage", async () => {
    const container = testContainer();
    const close = vi.fn();
    container.ownResource({ close });
    vi.stubGlobal("localStorage", undefined);

    await container.dispose();

    expect(close).toHaveBeenCalledOnce();
    expect(clearWalletAuth).not.toHaveBeenCalled();
  });
});
