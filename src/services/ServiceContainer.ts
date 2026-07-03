import { isE2E } from "@/utils/isE2E";
import {
  HubService,
  IDBService,
  LocalStorageService,
  PackageService,
  RelayService,
} from "@ownables/platform-browser";
import type { PublicClient, WalletClient } from "viem";
import { createE2EViemClients } from "./E2EWallet";
import { EQTYService } from "@ownables/adapter-viem";
import { EventChainService, PollingService } from "@ownables/core";
import type { AnchorProvider, KVStore } from "@ownables/core";
import BuilderService from "./Builder.service";
import { OwnableService } from "@ownables/core";
import { normalizeAnchorProvider } from "./normalizeAnchorProvider";
import { normalizeBrowserEqty } from "./normalizeBrowserEqty";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

const anchorAddresses: Record<number, `0x${string}` | undefined> = {
  8453: import.meta.env.VITE_BASE_MAINNET_ANCHOR_ADDRESS as `0x${string}` | undefined,
  84532: import.meta.env.VITE_BASE_SEPOLIA_ANCHOR_ADDRESS as `0x${string}` | undefined,
};

export interface ServiceMap {
  relay: RelayService;
  localStorage: LocalStorageService;
  eqty: EQTYService & AnchorProvider;
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

export default class ServiceContainer {
  private readonly cache = new Map<ServiceKey, Promise<any>>();
  private readonly factories = new Map<ServiceKey, ServiceFactory>();

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
          return normalizeAnchorProvider(
            normalizeBrowserEqty(
              new EQTYService(address, c.chainId!, walletClient, publicClient, undefined, {
                anchor: {
                  contractAddress: c.getAnchorContractAddress(),
                },
              })
            )
          );
        }

        return normalizeAnchorProvider(
          normalizeBrowserEqty(
            new EQTYService(c.address!, c.chainId!, c.walletClient, c.publicClient, undefined, {
              anchor: {
                contractAddress: c.getAnchorContractAddress(),
              },
            })
          )
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
      async (c) => new RelayService(await c.get("eqty"), { relayUrl })
    );

    this.register("hub", () => new HubService());

    this.register(
      "eventChains",
      async (c) =>
        new EventChainService(
          await c.get("idb"),
          await c.get("eqty"),
          new LocalStorageService() as unknown as KVStore
        )
    );

    this.register("packages", async (c) => {
      // Packages are stored globally and not per account
      const idb = await IDBService.packages();
      const legacyIdb = await IDBService.main();
      const storage = new LocalStorageService();
      return new PackageService(idb, await c.get("relay"), storage, {
        exampleUrl: import.meta.env.VITE_OWNABLE_EXAMPLES_URL,
        legacyIdb,
      });
    });

    this.register(
      "ownables",
      async (c) =>
        new OwnableService(
          await c.get("idb"),
          await c.get("eventChains"),
          await c.get("eqty"),
          await c.get("packages")
        )
    );

    this.register(
      "polling",
      async (c) =>
        new PollingService(await c.get("relay"), await c.get("localStorage"))
    );

    this.register(
      "builder",
      async (c) => new BuilderService(await c.get("packages"))
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

    const promise = Promise.resolve(this.factories.get(key)!(this)).catch(
      (error) => {
        this.cache.delete(key);
        throw error;
      }
    );
    this.cache.set(key, promise);

    return await promise;
  }

  async dispose(): Promise<void> {
    if (this.cache.has("idb")) {
      (await this.cache.get("idb")).close();
    }
  }
}
