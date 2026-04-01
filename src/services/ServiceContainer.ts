import { isE2E } from "@/utils/isE2E";
import type { PublicClient, WalletClient } from "viem";
import { createE2EViemClients } from "./E2EWallet";
import { EQTYService } from "@ownables/adapter-viem";
import {
  IDBService,
  LocalStorageService,
  PackageService,
  RelayService,
} from "@ownables/platform-browser/dist/platform-browser/src/index.js";
import {
  EventChainService,
  OwnableService,
  PollingService,
} from "@ownables/core";
import { BuilderService } from "@ownables/builder-client";
import workerJsSource from "@/assets/worker.js?raw";
import { PACKAGE_EXAMPLES, PACKAGE_EXAMPLE_URL } from "@/config/examples";

export interface ServiceMap {
  relay: RelayService;
  localStorage: LocalStorageService;
  eqty: EQTYService;
  idb: IDBService;
  eventChains: EventChainService;
  packages: PackageService;
  ownables: OwnableService;
  polling: PollingService;
  builder: BuilderService;
}

export type ServiceKey = keyof ServiceMap;

type ServiceFactory<T = any> = (container: ServiceContainer) => Promise<T> | T;

export default class ServiceContainer {
  private readonly cache = new Map<ServiceKey, Promise<any>>();
  private readonly factories = new Map<ServiceKey, ServiceFactory>();

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
          return new EQTYService(address, c.chainId!, walletClient, publicClient);
        }

        return new EQTYService(
          c.address!,
          c.chainId!,
          c.walletClient,
          c.publicClient
        );
      }
    );

    this.register("idb", async (c) =>
      IDBService.open(`${c.chainId}:${c.address}`)
    );

    this.register(
      "localStorage",
      async (c) => new LocalStorageService(`${c.chainId}:${c.address}`)
    );

    this.register(
      "relay",
      async (c) =>
        new RelayService(await c.get("eqty"), {
          relayUrl: import.meta.env.VITE_RELAY || import.meta.env.VITE_LOCAL,
        })
    );

    this.register(
      "eventChains",
      async (c) =>
        new EventChainService(
          await c.get("idb"),
          await c.get("eqty"),
          new LocalStorageService()
        )
    );

    this.register("packages", async (c) => {
      // Packages are stored globally and not per account
      const idb = await IDBService.main();
      const storage = new LocalStorageService();
      return new PackageService(idb, await c.get("relay"), storage, {
        exampleUrl: PACKAGE_EXAMPLE_URL,
        examples: PACKAGE_EXAMPLES,
      });
    });

    this.register(
      "ownables",
      async (c) =>
        new OwnableService(
          await c.get("idb"),
          await c.get("eventChains"),
          await c.get("eqty"),
          await c.get("packages"),
          {
            getWorkerSource: () => workerJsSource,
          }
        )
    );

    this.register(
      "polling",
      async (c) =>
        new PollingService(await c.get("relay"), await c.get("localStorage"))
    );

    this.register(
      "builder",
      async (c) =>
        new BuilderService(c.chainId!, {
          url: import.meta.env.VITE_BUILDER ?? "",
          apiKey: import.meta.env.VITE_BUILDER_API_KEY,
          serverWalletsEndpoint:
            import.meta.env.VITE_BUILDER_SERVER_WALLETS_ENDPOINT,
          uploadNetworkQueryKey: import.meta.env.VITE_BUILDER_NETWORK_PARAM,
        })
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
    if (!this.factories.has(key))
      throw new Error(`No service factory registered for key: ${key}`);
    if (this.cache.has(key)) return this.cache.get(key)!;

    const promise = this.factories.get(key)!(this);
    this.cache.set(key, promise);

    return await promise;
  }

  async dispose(): Promise<void> {
    if (this.cache.has("idb")) {
      (await this.cache.get("idb")).close();
    }
  }
}
