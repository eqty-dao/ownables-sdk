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
  emitted: Array<{ subjectId: string; eventType: string; data: Uint8Array }> = [];
  emittedSubjectIdOverride?: string;
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
    const emittedSubjectId = this.emittedSubjectIdOverride ?? subjectId;
    this.emitted.push({ subjectId: emittedSubjectId, eventType, data });
    return {
      subjectId: emittedSubjectId,
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

function installReplayRegisterGuard(service: any, rpc: ReturnType<typeof createRpcMock>) {
  let replayDepth = 0;
  let replayAttempts = 0;
  const originalAttemptReplayIndexedPublicEvents =
    service.attemptReplayIndexedPublicEvents.bind(service);
  service.attemptReplayIndexedPublicEvents = async (...args: Parameters<any>) => {
    replayAttempts += 1;
    replayDepth += 1;
    try {
      return await originalAttemptReplayIndexedPublicEvents(...(args as [any, any, any, any?]));
    } finally {
      replayDepth -= 1;
    }
  };

  const originalRegister = rpc.register.bind(rpc);
  rpc.register = async (...args: any[]) => {
    assert.ok(
      replayDepth > 0,
      "rpc.register must run only while replay is consuming public events"
    );
    return await originalRegister(...(args as [any, any, any]));
  };

  return {
    getReplayAttempts: () => replayAttempts,
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

async function verifyStoredRegisterEventsAreRejected() {
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
  new Event({
    "@context": "register_msg.json",
    source: eqty.address,
    transactionHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    blockNumber: 1,
    transactionIndex: 0,
    logIndex: 0,
    eventType: "consume",
    data: "0x1234",
  }).addTo(chain);

  const originalConsoleError = console.error;
  const capturedErrors: unknown[][] = [];
  console.error = (...args: unknown[]) => {
    capturedErrors.push(args);
  };

  try {
    await assert.rejects(
      service.apply(chain, []),
      /Unknown event type/,
      "stored register events must not replay as private-chain events"
    );
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(
    capturedErrors.length > 0,
    true,
    "stored register events should still hit the rejected unknown-event path internally"
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

async function verifyReplayIndexedPublicEventsFlow() {
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
  const replayGuard = installReplayRegisterGuard(service, rpc);
  eventChains.setStateDump(chain.id, chain.state.hex, []);
  const initialLatestHash = chain.latestHash.hex;

  const publicEvent = {
    source: eqty.address,
    transactionHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    blockNumber: 1,
    transactionIndex: 0,
    logIndex: 7,
    eventType: "consume",
    data: new Uint8Array([1, 2, 3]),
  };

  const replay = await service.replayIndexedPublicEvents(chain.id, [], [publicEvent, publicEvent]);

  assert.equal(replay.complete, true, "indexed public replay should complete");
  assert.equal(replay.appliedReplayKeys.length, 1, "only one unique replay key should apply");
  assert.equal(replay.duplicateReplayKeys.length, 1, "duplicate replay keys should be reported");
  assert.equal(replay.appliedPublicEvents.length, 1, "one public event should be applied");
  assert.equal(replay.duplicatePublicEvents.length, 1, "duplicate public events should be surfaced");
  assert.equal(replay.ignoredPublicEvents.length, 0, "valid public replay must not be ignored");
  assert.equal(
    replayGuard.getReplayAttempts(),
    1,
    "indexed public replay must route register through a replay attempt"
  );
  assert.equal(rpc.calls.register.length, 1, "indexed public replay must register exactly once");
  assert.equal(eqty.signed.length, 0, "public replay must not sign a private follow-up event");
  assert.equal(
    chain.latestHash.hex,
    initialLatestHash,
    "public replay must not mutate the private event chain"
  );
}

async function verifyRegisterOutsideReplayIsRejected() {
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
  installReplayRegisterGuard(service, rpc);

  await assert.rejects(
    rpc.register(
      {
        source: eqty.address,
        eventType: "consume",
        data: new Uint8Array([1, 2, 3]),
        blockNumber: 1,
        transactionHash: new Uint8Array(32),
        transactionIndex: 0,
        logIndex: 0,
      },
      { sender: eqty.address, funds: [] },
      []
    ),
    /rpc\.register must run only while replay is consuming public events/,
    "rpc.register must fail immediately when replay is inactive"
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
  const replayGuard = installReplayRegisterGuard(service, rpc);
  eventChains.setStateDump(chain.id, chain.state.hex, []);
  const initialLatestHash = chain.latestHash.hex;

  const observation = await service.emitPublicEvent(chain, "consume", { amount: "10" });

  assert.equal(rpc.calls.encodePublicEvent.length, 1, "emit flow must encode the public event");
  assert.equal(eqty.emitted.length, 1, "emit flow must publish through EQTY");
  assert.equal(
    replayGuard.getReplayAttempts(),
    0,
    "emit flow must not silently trigger replay on its own"
  );
  assert.equal(
    rpc.calls.register.length,
    0,
    "emit flow must not bless an imperative post-emit register step"
  );
  assert.equal(
    observation.ignoredPublicEvents.length,
    0,
    "emit flow must surface a valid emitted public event without replay errors"
  );
  assert.ok(observation.publicEvent, "emit flow must return the emitted public event for replay");
  assert.deepEqual(
    Array.from(eqty.emitted[0].data),
    Array.from(rpc.calls.encodePublicEvent[0].payload),
    "published data must be the worker-encoded payload"
  );
  assert.equal(
    eqty.signed.length,
    0,
    "emit flow must not sign a private follow-up event"
  );
  assert.equal(
    chain.latestHash.hex,
    initialLatestHash,
    "emit flow must leave the private chain unchanged"
  );

  const replay = await service.replayPublicEvent(chain, observation.publicEvent);

  assert.equal(replay.complete, true, "replay must apply the emitted public event");
  assert.equal(
    replayGuard.getReplayAttempts(),
    1,
    "ownable-side register must happen only while replay is consuming the emitted public event"
  );
  assert.equal(replay.appliedReplayKeys.length, 1, "replay must apply exactly one replay key");
  assert.equal(replay.appliedPublicEvents.length, 1, "replay must apply one public event");
  assert.equal(replay.duplicatePublicEvents.length, 0, "replay must not report duplicates");
  assert.equal(replay.ignoredPublicEvents.length, 0, "replay must not ignore a valid public event");
  assert.equal(rpc.calls.register.length, 1, "replay must register exactly once");
  assert.equal(
    await idb.get(`ownable:${chain.id}.public-event-replays`, replay.appliedReplayKeys[0]),
    true,
    "replay must persist evidence for the emitted public event"
  );
}

async function verifyEmitPublicEventIgnoresInvalidSubjectId() {
  const idb = new MemoryIDB();
  const eventChains = new MockEventChains();
  const eqty = new MockEqty();
  eqty.emittedSubjectIdOverride = "0x" + "99".repeat(32);
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
  const initialLatestHash = chain.latestHash.hex;

  const observation = await service.emitPublicEvent(chain, "consume", { amount: "10" });

  assert.equal(
    observation.ignoredPublicEvents.length,
    1,
    "invalid subject ids must be surfaced without replay"
  );
  assert.equal(
    observation.ignoredPublicEvents[0].reason,
    "invalid_subject_id",
    "invalid subject ids must be ignored rather than stored privately"
  );
  assert.equal(
    observation.publicEvent,
    undefined,
    "invalid subject ids must not produce a replayable public event"
  );
  assert.equal(rpc.calls.register.length, 0, "invalid subject ids must not call register");
  assert.equal(eqty.signed.length, 0, "ignored public events must not sign a private follow-up");
  assert.equal(
    chain.latestHash.hex,
    initialLatestHash,
    "ignored public events must leave the private chain unchanged"
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
    }),
    getLogs: async () => [
      {
        transactionHash,
        logIndex: 9,
        args: {
          subjectId: "0x" + "66".repeat(32),
          source: "0x0000000000000000000000000000000000000001",
          eventType: "consume",
          data: "0x010203",
        },
      },
    ],
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
  await verifyStoredRegisterEventsAreRejected();
  await verifyConsumeFlow();
  await verifyReplayIndexedPublicEventsFlow();
  await verifyRegisterOutsideReplayIsRejected();
  await verifyEncodePublicEventBridge();
  await verifyEmitPublicEventFlow();
  await verifyEmitPublicEventIgnoresInvalidSubjectId();
  await verifyEqtyPublicEventFeeForwarding();
  await verifyServiceContainerInjectsAnchorConfig();
  await verifyEqtyAllowanceManagement();
  console.log("external-events runtime verification passed");
}

main().catch((error) => {
  console.error("external-events runtime verification failed");
  console.error(error);
  process.exit(1);
});
