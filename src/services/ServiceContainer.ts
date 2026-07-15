import { isE2E } from "@/utils/isE2E";
import {
  BrowserRuntimeRpcProvider,
  BrowserRuntimeSourceProvider,
  HubService,
  IDBService,
  LocalStorageService,
  PackageService,
  RelayService,
} from "@ownables/platform-browser";
import type { PublicClient, WalletClient } from "viem";
import { createE2EViemClients } from "@/utils/E2EWallet";
import { EQTYService } from "@ownables/adapter-viem";
import { AnchorValidationService, EventChainService, OwnablePackageCidService, OwnableService, PollingService, PublicEventReplayService } from "@ownables/core";
import type { AnchorProvider, KVStore } from "@ownables/core";
import { BuilderService } from "@ownables/builder";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

const anchorAddresses: Record<number, `0x${string}` | undefined> = {
  8453: import.meta.env.VITE_BASE_MAINNET_ANCHOR_ADDRESS as `0x${string}` | undefined,
  84532: import.meta.env.VITE_BASE_SEPOLIA_ANCHOR_ADDRESS as `0x${string}` | undefined,
};

export interface ServiceMap {
  relay: RelayService;
  localStorage: LocalStorageService;
  eqty: EQTYService & AnchorProvider;
  anchorValidation: AnchorValidationService;
  replay: PublicEventReplayService;
  packageCid: OwnablePackageCidService;
  runtimeSource: BrowserRuntimeSourceProvider;
  runtimeRpc: BrowserRuntimeRpcProvider;
  idb: IDBService;
  eventChains: EventChainService;
  packages: PackageService;
  ownables: OwnableService;
  polling: PollingService;
  builder: BuilderService;
  hub: HubService;
}

export type ServiceKey = keyof ServiceMap;

type ServiceFactory<T = any> = (container: ServiceContainer) => Promise<T> | T;
const relayUrl = import.meta.env.VITE_RELAY || import.meta.env.VITE_LOCAL || "";
const hubUrl = import.meta.env.VITE_HUB || "";

export default class ServiceContainer {
  private readonly cache = new Map<ServiceKey, Promise<any>>();
  private readonly factories = new Map<ServiceKey, ServiceFactory>();
  private readonly resources: Array<{ close(): void | Promise<void> }> = [];
  private disposePromise?: Promise<void>;
  private disposalStarted = false;

  private getAnchorContractAddress(): `0x${string}` {
    return anchorAddresses[this.chainId] ?? ZERO_ADDRESS;
  }

  constructor(
    public readonly address: string,
    public readonly chainId: number,
    public readonly walletClient?: WalletClient,
    public readonly publicClient?: PublicClient
  ) {
    this.register(
      "eqty",
      async (c) => {
        if (isE2E) {
          const { address, walletClient, publicClient } = createE2EViemClients(
            c.chainId!
          );
          return new EQTYService(address, c.chainId!, walletClient, publicClient, undefined, {
            anchor: { contractAddress: c.getAnchorContractAddress() },
          });
        }

        return new EQTYService(c.address!, c.chainId!, c.walletClient, c.publicClient, undefined, {
          anchor: { contractAddress: c.getAnchorContractAddress() },
        });
      }
    );

    this.register("anchorValidation", async (c) => new AnchorValidationService(await c.get("eqty")));
    this.register("replay", () => new PublicEventReplayService());
    this.register("packageCid", () => new OwnablePackageCidService());
    this.register("runtimeSource", () => new BrowserRuntimeSourceProvider());
    this.register("runtimeRpc", () => new BrowserRuntimeRpcProvider());
    this.register("idb", async (c) => c.ownResource(await IDBService.open(`${c.chainId}:${c.address}`)));

    this.register(
      "localStorage",
      async (c) => new LocalStorageService(`${c.chainId}:${c.address}`)
    );

    this.register(
      "relay",
      async (c) => new RelayService(await c.get("eqty"), { relayUrl })
    );

    this.register("hub", () => new HubService(hubUrl));

    this.register(
      "eventChains",
      async (c) =>
        new EventChainService(
          await c.get("idb"),
          await c.get("eqty"),
          await c.get("anchorValidation"),
          new LocalStorageService() as unknown as KVStore
        )
    );

    this.register("packages", async (c) => {
      // Packages are stored globally and not per account
      const idb = c.ownResource(await IDBService.packages());
      const legacyIdb = c.ownResource(await IDBService.main());
      const storage = new LocalStorageService();
      return new PackageService(idb, await c.get("relay"), storage, {
        exampleUrl: import.meta.env.VITE_OWNABLE_EXAMPLES_URL,
        legacyIdb,
        cidService: await c.get("packageCid"),
      });
    });

    this.register(
      "ownables",
      async (c) =>
        new OwnableService({ stateStore: await c.get("idb"), eventChains: await c.get("eventChains"), anchorProvider: await c.get("eqty"), packages: await c.get("packages"), runtimeSource: await c.get("runtimeSource"), runtimeRpc: await c.get("runtimeRpc"), replay: await c.get("replay") })
    );

    this.register(
      "polling",
      async (c) =>
        new PollingService(await c.get("relay"), await c.get("localStorage"))
    );

    this.register(
      "builder",
      async (c) => new BuilderService({ packageService: await c.get("packages") })
    );
  }

  get key() {
    return `${this.address}:${this.chainId}`;
  }

  private register<K extends ServiceKey>(
    key: K,
    factory: ServiceFactory<ServiceMap[K]>
  ): void {
    this.factories.set(key, factory as ServiceFactory);
  }

  has(key: ServiceKey): boolean {
    return this.factories.has(key);
  }

  async get<K extends ServiceKey>(key: K): Promise<ServiceMap[K]> {
    if (this.disposalStarted) throw new Error("Service container is disposing or disposed");
    if (!this.factories.has(key))
      throw new Error(`No service factory registered for key: ${key}`);
    if (this.cache.has(key)) return this.cache.get(key)!;

    const promise = Promise.resolve(this.factories.get(key)!(this)).catch(
      async (error) => {
        this.cache.delete(key);
        if (this.resources.length > 0) await this.dispose();
        throw error;
      }
    );
    this.cache.set(key, promise);

    return await promise;
  }

  private ownResource<T extends { close(): void | Promise<void> }>(resource: T): T {
    this.resources.push(resource);
    return resource;
  }

  async dispose(): Promise<void> {
    if (this.disposePromise) return this.disposePromise;
    this.disposalStarted = true;
    RelayService.clearWalletAuth(this.address, this.chainId);
    this.disposePromise = (async () => {
      await Promise.allSettled(this.cache.values());
      const resources = [...this.resources].reverse();
      this.resources.length = 0;
      const results = await Promise.allSettled(
        resources.map((resource) => resource.close())
      );
      this.cache.clear();
      const failures = results.filter(
        (result): result is PromiseRejectedResult => result.status === "rejected"
      );
      if (failures.length > 0) {
        throw new AggregateError(
          failures.map((failure) => failure.reason),
          "Failed to dispose one or more SDK resources"
        );
      }
    })();
    return this.disposePromise;
  }
}
