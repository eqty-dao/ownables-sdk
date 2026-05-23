import assert from "node:assert/strict";
import { Event, EventChain } from "eqty-core";
import OwnableService, { StateDump } from "../services/Ownable.service";

type StoreMap = Map<string, any>;

class MemoryIDB {
  private stores = new Map<string, StoreMap>();

  async hasStore(name: string): Promise<boolean> {
    return this.stores.has(name);
  }

  async createStore(...names: string[]): Promise<void> {
    for (const name of names) {
      if (!this.stores.has(name)) this.stores.set(name, new Map());
    }
  }

  async get(store: string, key: string): Promise<any> {
    return this.stores.get(store)?.get(key);
  }

  async set(store: string, key: string, value: any): Promise<void> {
    if (!this.stores.has(store)) this.stores.set(store, new Map());
    this.stores.get(store)!.set(key, value);
  }

  async keys(store: string): Promise<string[]> {
    return Array.from(this.stores.get(store)?.keys() ?? []);
  }

  async getAll(store: string): Promise<any[]> {
    return Array.from(this.stores.get(store)?.values() ?? []);
  }

  async setAll(data: Record<string, any>): Promise<void> {
    for (const [store, value] of Object.entries(data)) {
      if (!this.stores.has(store)) this.stores.set(store, new Map());
      const target = this.stores.get(store)!;
      if (value instanceof Map) {
        target.clear();
        for (const [k, v] of value.entries()) target.set(k, v);
      } else if (value && typeof value === "object") {
        for (const [k, v] of Object.entries(value)) target.set(k, v);
      }
    }
  }
}

class MockEventChains {
  anchoring = false;
  private readonly dumps = new Map<string, StateDump>();

  setStateDump(chainId: string, stateHex: string, dump: StateDump): void {
    this.dumps.set(`${chainId}:${stateHex}`, dump);
  }

  async getStateDump(chainId: string, state: string): Promise<StateDump | null> {
    return this.dumps.get(`${chainId}:${state}`) ?? null;
  }

  async loadAll(): Promise<any[]> {
    return [];
  }
}

class MockEqty {
  address = "0x0000000000000000000000000000000000000001";
  chainId = 84532;
  signed: Event[] = [];
  private signer = {
    getAddress: async () => this.address,
    signTypedData: async () =>
      "0x" + "11".repeat(65),
  };

  async sign(event: Event): Promise<void> {
    await event.signWith(this.signer as any);
    this.signed.push(event);
  }

  async anchor(..._anchors: Array<any>): Promise<void> {}

  async submitAnchors(): Promise<string | undefined> {
    return undefined;
  }
}

function createRpcMock(chainId: string) {
  const calls = {
    register: [] as any[],
    ingest: [] as any[],
    execute: [] as any[],
    query: [] as any[],
  };
  return {
    calls,
    async instantiate() {
      return { attributes: {}, state: [] as StateDump };
    },
    async execute(msg: any, _info: any, _state: StateDump) {
      calls.execute.push(msg);
      return {
        attributes: {},
        events: [{ type: "consume", attributes: { amount: "10", chainId } }],
        data: "",
        state: [] as StateDump,
      };
    },
    async register(event: any, info: any, _state: StateDump) {
      calls.register.push({ event, info });
      return { attributes: {}, events: [], data: "", state: [] as StateDump };
    },
    async ingest(event: any, info: any, _state: StateDump) {
      calls.ingest.push({ event, info });
      return { attributes: {}, events: [], data: "", state: [] as StateDump };
    },
    async query(msg: any) {
      calls.query.push(msg);
      if (msg?.get_info) {
        return { owner: "owner-1", issuer: "issuer-1", ownable_type: "potion" };
      }
      return {};
    },
    async encodePublicEvent(_eventType: string, payload: Uint8Array) {
      return payload;
    },
    setWidgetWindow(_win: Window | null) {},
    terminate() {},
    async refresh(_state: StateDump) {},
  };
}

async function verifyReplayContexts() {
  const idb = new MemoryIDB();
  const eventChains = new MockEventChains();
  const eqty = new MockEqty();
  const service = new OwnableService(
    idb as any,
    eventChains as any,
    eqty as any,
    {} as any
  ) as any;

  const registerChain = EventChain.create(eqty.address, eqty.chainId);
  const registerRpc = createRpcMock(registerChain.id);
  service._rpc.set(registerChain.id, registerRpc);

  new Event({
    "@context": "register_public_event_msg.json",
    chainId: eqty.chainId,
    contractAddress: "0x1111111111111111111111111111111111111111",
    transactionHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    logIndex: 0,
    eventType: "consume",
    attributes: { amount: "10" },
    data: "0x1234",
  }).addTo(registerChain);

  await service.apply(registerChain, []);

  const ingestChain = EventChain.create(eqty.address, eqty.chainId);
  const ingestRpc = createRpcMock(ingestChain.id);
  service._rpc.set(ingestChain.id, ingestRpc);

  new Event({
    "@context": "ingest_event_msg.json",
    source: { id: "source-1", owner: "owner-1", issuer: "issuer-1" },
    eventType: "consume",
    attributes: { amount: "10" },
  }).addTo(ingestChain);

  await service.apply(ingestChain, []);

  assert.equal(registerRpc.calls.register.length, 1, "register replay must be invoked once");
  assert.equal(ingestRpc.calls.ingest.length, 1, "ingest replay must be invoked once");
  assert.equal(
    registerRpc.calls.register[0].info.sender,
    eqty.address,
    "replay sender should resolve to active signer address"
  );
}

async function verifyConsumeFlow() {
  const idb = new MemoryIDB();
  const eventChains = new MockEventChains();
  const eqty = new MockEqty();
  const service = new OwnableService(
    idb as any,
    eventChains as any,
    eqty as any,
    {} as any
  ) as any;

  const consumable = EventChain.create(eqty.address, eqty.chainId);
  const consumer = EventChain.create(eqty.address, eqty.chainId);

  eventChains.setStateDump(consumable.id, consumable.state.hex, []);
  eventChains.setStateDump(consumer.id, consumer.state.hex, []);

  await idb.createStore(
    `ownable:${consumable.id}`,
    `ownable:${consumable.id}.state`,
    `ownable:${consumer.id}`,
    `ownable:${consumer.id}.state`
  );

  const consumableRpc = createRpcMock(consumable.id);
  const consumerRpc = createRpcMock(consumer.id);
  service._rpc.set(consumable.id, consumableRpc);
  service._rpc.set(consumer.id, consumerRpc);

  await service.consume(consumer, consumable);

  assert.equal(consumableRpc.calls.execute.length, 1, "consume producer execute must run");
  assert.equal(consumerRpc.calls.ingest.length, 1, "consumer ingest must run");
  assert.equal(
    consumerRpc.calls.ingest[0].event.source.id,
    consumable.id,
    "ingest source id must match consumable chain id"
  );
  assert.equal(eqty.signed.length, 2, "consume flow should sign both producer and consumer events");
}

async function main() {
  await verifyReplayContexts();
  await verifyConsumeFlow();
  console.log("external-events runtime verification passed");
}

main().catch((error) => {
  console.error("external-events runtime verification failed");
  console.error(error);
  process.exit(1);
});
