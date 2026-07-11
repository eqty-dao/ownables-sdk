import assert from "node:assert/strict";
import { Event, EventChain } from "eqty-core";
import { decode, encode } from "cbor-x";
import { EQTYService } from "@ownables/adapter-viem";
import {
  type StateDump,
  OwnableService,
  WorkerRPC,
} from "@ownables/core";
import ServiceContainer from "@/services/ServiceContainer";
import { encodeAbiParameters, encodeEventTopics, parseAbiItem } from "viem";

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

  async delete(store: string, key: string): Promise<void> {
    this.stores.get(store)?.delete(key);
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
  emitted: Array<{ subjectId: string; eventType: string; data: Uint8Array }> = [];
  private signer = {
    getAddress: async () => this.address,
    signTypedData: async () =>
      "0x" + "11".repeat(65),
  };

  async sign(event: Event): Promise<void> {
    await event.signWith(this.signer as any);
    this.signed.push(event);
  }

  async emitPublicEvent(subjectId: string, eventType: string, data: Uint8Array) {
    this.emitted.push({ subjectId, eventType, data });
    return {
      subjectId,
      source: this.address,
      transactionHash: "0x" + "44".repeat(32),
      blockNumber: 1,
      transactionIndex: 0,
      logIndex: this.emitted.length,
      eventType,
      data,
    };
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
    encodePublicEvent: [] as any[],
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
      calls.encodePublicEvent.push({ eventType: _eventType, payload });
      return payload;
    },
    setWidgetWindow(_win: Window | null) {},
    terminate() {},
    async refresh(_state: StateDump) {},
  };
}

class FakeWorker extends EventTarget {
  messages: any[] = [];

  postMessage(message: any): void {
    this.messages.push(message);
    if (message.type !== "encode_public_event") {
      this.dispatchEvent(
        new MessageEvent("message", { data: { err: `unexpected type ${message.type}` } })
      );
      return;
    }

    const request = decode(new Uint8Array(message.input)) as {
      eventType: string;
      data: Uint8Array;
    };
    const output = encode({
      success: true,
      payload: request.data,
    });
    this.dispatchEvent(new MessageEvent("message", { data: { output } }));
  }

  terminate(): void {}
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
    "@context": "register_msg.json",
    source: eqty.address,
    transactionHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    blockNumber: 1,
    transactionIndex: 0,
    logIndex: 0,
    eventType: "consume",
    data: "0x1234",
  }).addTo(registerChain);

  await service.apply(registerChain, []);

  const ingestChain = EventChain.create(eqty.address, eqty.chainId);
  const ingestRpc = createRpcMock(ingestChain.id);
  service._rpc.set(ingestChain.id, ingestRpc);

  new Event({
    "@context": "ingest_msg.json",
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

async function verifyRegisterPublicEventFlow() {
  const idb = new MemoryIDB();
  const eventChains = new MockEventChains();
  const eqty = new MockEqty();
  const service = new OwnableService(
    idb as any,
    eventChains as any,
    eqty as any,
    {} as any
  ) as any;

  const chain = EventChain.create(eqty.address, eqty.chainId);
  const rpc = createRpcMock(chain.id);
  service._rpc.set(chain.id, rpc);
  eventChains.setStateDump(chain.id, chain.state.hex, []);

  const publicEvent = {
    source: eqty.address,
    transactionHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    blockNumber: 1,
    transactionIndex: 0,
    logIndex: 7,
    eventType: "consume",
    data: new Uint8Array([1, 2, 3]),
  };

  await service.registerPublicEvent(chain, publicEvent);
  eventChains.setStateDump(chain.id, chain.state.hex, []);
  await service.registerPublicEvent(chain, publicEvent);

  assert.equal(rpc.calls.register.length, 1, "duplicate public event replay must be ignored");
  assert.equal(eqty.signed.length, 1, "deduped public event should sign once");
  assert.equal(
    eqty.signed[0].parsedData["@context"],
    "register_msg.json",
    "registerPublicEvent must persist a register replay event"
  );
}

async function verifyEncodePublicEventBridge() {
  const rpc = new WorkerRPC("bridge-test") as any;
  const worker = new FakeWorker();
  rpc.worker = worker;

  const payload = new Uint8Array([9, 8, 7]);
  const encoded = await rpc.encodePublicEvent("consume", payload);

  assert.deepEqual(Array.from(encoded), [9, 8, 7], "bridge must return encoded payload bytes");
  assert.equal(worker.messages.length, 1, "bridge should post exactly one worker message");
  assert.equal(worker.messages[0].type, "encode_public_event");
  const request = decode(new Uint8Array(worker.messages[0].input)) as {
    eventType: string;
    data: Uint8Array;
  };
  assert.equal(request.eventType, "consume");
  assert.deepEqual(Array.from(request.data), [9, 8, 7]);
}

async function verifyEmitPublicEventFlow() {
  const idb = new MemoryIDB();
  const eventChains = new MockEventChains();
  const eqty = new MockEqty();
  const service = new OwnableService(
    idb as any,
    eventChains as any,
    eqty as any,
    {} as any
  ) as any;

  const chain = EventChain.create(eqty.address, eqty.chainId);
  const rpc = createRpcMock(chain.id);
  service._rpc.set(chain.id, rpc);
  eventChains.setStateDump(chain.id, chain.state.hex, []);

  const replay = await service.emitPublicEvent(chain, "consume", { amount: "10" });

  assert.equal(rpc.calls.encodePublicEvent.length, 1, "emit flow must encode the public event");
  assert.equal(eqty.emitted.length, 1, "emit flow must publish through EQTY");
  assert.equal(
    rpc.calls.register.length,
    0,
    "emit flow must not register the public event until Hub confirmation arrives"
  );
  assert.deepEqual(
    Array.from(eqty.emitted[0].data),
    Array.from(rpc.calls.encodePublicEvent[0].payload),
    "published data must be the worker-encoded payload"
  );
  assert.deepEqual(
    replay.appliedReplayKeys,
    [],
    "emit flow must not report immediate replay application"
  );
  assert.equal(replay.pendingPublicEvents.length, 1, "emit flow must create one pending replay record");
  assert.equal(replay.pendingPublicEvents[0].status, "pending");
  assert.deepEqual(replay.pendingPublicEvents[0].sources, ["local"]);
  assert.deepEqual(
    await service.listTrackedPublicEvents(chain.id),
    replay.pendingPublicEvents,
    "pending local public events must be stored in the replay store"
  );
}

async function verifyEqtyPublicEventFeeForwarding() {
  const transactionHash = "0x" + "55".repeat(32);
  let writeContractInput: any;
  const anchorContractAddress = import.meta.env.VITE_BASE_SEPOLIA_ANCHOR_ADDRESS;
  if (!anchorContractAddress) {
    throw new Error("VITE_BASE_SEPOLIA_ANCHOR_ADDRESS must be configured for runtime verification");
  }
  const verifiedAnchorContractAddress: `0x${string}` = anchorContractAddress;
  const publicEventAbi = parseAbiItem(
    "event PublicEvent(bytes32 indexed subjectId, address indexed source, string eventType, bytes data, uint64 timestamp)"
  );
  const encodedTopics = encodeEventTopics({
    abi: [publicEventAbi],
    eventName: "PublicEvent",
    args: {
      subjectId: ("0x" + "66".repeat(32)) as `0x${string}`,
      source: "0x0000000000000000000000000000000000000001",
    },
  });
  const encodedData = encodeAbiParameters(
    [
      { name: "eventType", type: "string" },
      { name: "data", type: "bytes" },
      { name: "timestamp", type: "uint64" },
    ],
    ["consume", "0x010203", 99n]
  );

  const walletClient = {
    account: "0x0000000000000000000000000000000000000001",
    writeContract: async (input: any) => {
      writeContractInput = input;
      return transactionHash;
    },
  };
  const publicClient = {
    readContract: async ({ functionName }: { functionName: string }) => {
      switch (functionName) {
        case "quoteEqtyCost":
          return 12n;
        case "eqtyToken":
          return "0x1111111111111111111111111111111111111111";
        case "allowance":
          return 0n;
        case "quoteEthCost":
          return 34n;
        default:
          throw new Error(`unexpected readContract ${functionName}`);
      }
    },
    waitForTransactionReceipt: async () => ({
      blockNumber: 123n,
      transactionIndex: 4,
      logs: [
        {
          address: verifiedAnchorContractAddress,
          transactionHash,
          logIndex: 9,
          data: encodedData,
          topics: encodedTopics,
        },
      ],
    }),
  };
  const service = new EQTYService(
    "0x0000000000000000000000000000000000000001",
    84532,
    walletClient as any,
    publicClient as any,
    undefined,
    {
      anchor: {
        contractAddress: verifiedAnchorContractAddress,
      },
    }
  );

  const event = await service.emitPublicEvent(
    "0x" + "66".repeat(32),
    "consume",
    Uint8Array.from([1, 2, 3])
  );

  assert.equal(writeContractInput.value, 34n, "public event emit must forward required ETH fee");
  assert.equal(event.transactionHash, transactionHash);
  assert.equal(event.transactionIndex, 4);
  assert.equal(event.logIndex, 9);
  assert.equal(event.data, "0x010203");
}

async function verifyServiceContainerInjectsAnchorConfig() {
  const walletClient = {
    account: "0x0000000000000000000000000000000000000001",
  };
  const publicClient = {
    readContract: async ({ functionName }: { functionName: string }) => {
      switch (functionName) {
        case "quoteEqtyCost":
        case "quoteEthCost":
          return 0n;
        case "eqtyToken":
          return "0x0000000000000000000000000000000000000000";
        default:
          throw new Error(`unexpected readContract ${functionName}`);
      }
    },
  };

  const container = new ServiceContainer(
    "0x0000000000000000000000000000000000000001",
    84532,
    walletClient as any,
    publicClient as any
  );

  try {
    const eqty = (await container.get("eqty")) as any;
    assert.equal(
      eqty.anchorContractAddress,
      import.meta.env.VITE_BASE_SEPOLIA_ANCHOR_ADDRESS,
      "ServiceContainer must inject the SDK-owned Anchor address into EQTYService"
    );
  } finally {
    await container.dispose();
  }
}

async function verifyServiceContainerInjectsHubConfig() {
  const container = new ServiceContainer(
    "0x0000000000000000000000000000000000000001",
    84532
  );

  try {
    const hub = (await container.get("hub")) as any;
    assert.equal(
      hub.isConfigured,
      Boolean(import.meta.env.VITE_HUB),
      "ServiceContainer must inject the SDK-owned Hub URL into HubService"
    );
    if (import.meta.env.VITE_HUB) {
      assert.equal(
        hub.origin,
        new URL(import.meta.env.VITE_HUB).origin,
        "HubService must derive its origin from the configured VITE_HUB"
      );
    }
  } finally {
    await container.dispose();
  }
}

async function verifyEqtyAllowanceManagement() {
  let approveInput: any;
  const anchorContractAddress = import.meta.env.VITE_BASE_SEPOLIA_ANCHOR_ADDRESS;
  if (!anchorContractAddress) {
    throw new Error("VITE_BASE_SEPOLIA_ANCHOR_ADDRESS must be configured for runtime verification");
  }
  const verifiedAnchorContractAddress: `0x${string}` = anchorContractAddress;

  const walletClient = {
    account: "0x0000000000000000000000000000000000000001",
    writeContract: async (input: any) => {
      approveInput = input;
      return "0x" + "77".repeat(32);
    },
  };

  const publicClient = {
    readContract: async ({ functionName, args }: { functionName: string; args?: unknown[] }) => {
      switch (functionName) {
        case "eqtyToken":
          return "0x1111111111111111111111111111111111111111";
        case "allowance":
          assert.deepEqual(
            args,
            ["0x0000000000000000000000000000000000000001", verifiedAnchorContractAddress],
            "allowance reads must target the signer and configured Anchor contract"
          );
          return 27n;
        default:
          throw new Error(`unexpected readContract ${functionName}`);
      }
    },
  };

  const service = new EQTYService(
    "0x0000000000000000000000000000000000000001",
    84532,
    walletClient as any,
    publicClient as any,
    undefined,
    {
      anchor: {
        contractAddress: verifiedAnchorContractAddress,
      },
    }
  );

  const allowance = await service.getAnchorEqtyAllowance();
  const approvalTxHash = await service.setAnchorEqtyAllowance(42n);

  assert.equal(allowance, 27n);
  assert.equal(approvalTxHash, "0x" + "77".repeat(32));
  assert.equal(approveInput.functionName, "approve");
  assert.deepEqual(approveInput.args, [verifiedAnchorContractAddress, 42n]);
}

async function main() {
  await verifyReplayContexts();
  await verifyConsumeFlow();
  await verifyRegisterPublicEventFlow();
  await verifyEncodePublicEventBridge();
  await verifyEmitPublicEventFlow();
  await verifyEqtyPublicEventFeeForwarding();
  await verifyServiceContainerInjectsAnchorConfig();
  await verifyServiceContainerInjectsHubConfig();
  await verifyEqtyAllowanceManagement();
  console.log("external-events runtime verification passed");
}

main().catch((error) => {
  console.error("external-events runtime verification failed");
  console.error(error);
  process.exit(1);
});
