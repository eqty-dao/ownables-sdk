import { decode } from "cbor-x";
import {
  Binary,
  type EventChain,
} from "eqty-core";
import {
  publicEventReplayKey,
  type AnchorValidationResult,
  type IndexedPublicEvent,
} from "@ownables/core";
import type { HubService } from "@ownables/platform-browser";
import type { TimelinePublicEvent } from "@/components/ownableTimeline";

const PUBLIC_EVENT_ABI = {
  type: "event",
  name: "PublicEvent",
  inputs: [
    { indexed: true, name: "subjectId", type: "bytes32" },
    { indexed: true, name: "source", type: "address" },
    { indexed: false, name: "eventType", type: "string" },
    { indexed: false, name: "data", type: "bytes" },
    { indexed: false, name: "timestamp", type: "uint64" },
  ],
} as const;

interface HubVerificationPublicEvent {
  kind: "public";
  replayKey: string;
  transactionHash: string;
  transactionIndex: number;
  logIndex: number;
  blockNumber: string;
  eventTimestamp: string | null;
  sourceAddress: string;
  eventType: string;
  dataHex: string;
  payloadJson: unknown;
  replayStatus: "applied" | "ignored";
  ignoredReason?: string;
}

interface HubVerificationResponse {
  verified: boolean;
  anchorVerification: AnchorValidationResult;
  publicEvents: HubVerificationPublicEvent[];
}

export interface OwnableVerificationResult {
  verified: boolean;
  anchorVerification: AnchorValidationResult;
  publicEvents: TimelinePublicEvent[];
  source: "hub" | "local";
}

function decodePublicPayload(dataHex: string): unknown {
  try {
    return decode(Binary.fromHex(dataHex));
  } catch {
    return {
      dataHex,
    };
  }
}

function verificationEndpoint(hub: HubService, ownableId: string): string {
  const origin = hub.origin.replace(/\/$/, "");
  return `${origin}/ownables/${encodeURIComponent(ownableId)}/verification`;
}

function normalizeHubPublicEvents(events: HubVerificationPublicEvent[]): TimelinePublicEvent[] {
  return events.map((event) => ({
    source: event.sourceAddress,
    eventType: event.eventType,
    data: event.dataHex,
    blockNumber: Number(event.blockNumber),
    transactionHash: event.transactionHash,
    transactionIndex: event.transactionIndex,
    logIndex: event.logIndex,
    ...(event.eventTimestamp ? { timestamp: Number(event.eventTimestamp) } : {}),
    replayKey: event.replayKey,
    replayStatus: event.replayStatus,
    ...(event.ignoredReason ? { ignoredReason: event.ignoredReason } : {}),
    payloadJson: event.payloadJson,
  }));
}

async function resolveAnchorFromBlock(
  publicClient: {
    getTransactionReceipt?: (input: { hash: `0x${string}` }) => Promise<{ blockNumber?: bigint | number }>;
  },
  anchorVerification: AnchorValidationResult
): Promise<bigint | undefined> {
  const transactionHashes = Array.from(
    new Set(
      Object.values(anchorVerification.anchors).filter(
        (transactionHash): transactionHash is `0x${string}` =>
          typeof transactionHash === "string" && transactionHash.startsWith("0x")
      )
    )
  );

  if (transactionHashes.length === 0 || !publicClient.getTransactionReceipt) {
    return undefined;
  }

  const blockNumbers = await Promise.all(
    transactionHashes.map(async (hash) => {
      try {
        const receipt = await publicClient.getTransactionReceipt!({ hash });
        return receipt.blockNumber === undefined
          ? undefined
          : BigInt(receipt.blockNumber);
      } catch {
        return undefined;
      }
    })
  );

  const defined = blockNumbers.filter((value): value is bigint => value !== undefined);
  if (defined.length === 0) return undefined;

  return defined.reduce((lowest, current) => (current < lowest ? current : lowest));
}

function normalizeLocalPublicEvent(log: any): TimelinePublicEvent {
  const dataHex =
    typeof log.args?.data === "string"
      ? log.args.data
      : new Binary(log.args?.data ?? new Uint8Array()).hex;

  const indexedPublicEvent: IndexedPublicEvent = {
    source: String(log.args?.source ?? ""),
    eventType: String(log.args?.eventType ?? ""),
    data: dataHex,
    blockNumber: Number(log.blockNumber ?? 0),
    transactionHash: String(log.transactionHash),
    transactionIndex: Number(log.transactionIndex ?? 0),
    logIndex: Number(log.logIndex ?? 0),
    ...(log.args?.timestamp !== undefined ? { timestamp: Number(log.args.timestamp) } : {}),
  };

  return {
    ...indexedPublicEvent,
    replayKey: publicEventReplayKey(indexedPublicEvent),
    replayStatus: "applied",
    payloadJson: decodePublicPayload(dataHex),
  };
}

async function loadLocalOwnableVerification(
  chain: EventChain,
  anchorVerification: AnchorValidationResult,
  eqty: any
): Promise<OwnableVerificationResult> {
  const publicClient = eqty?.publicClient as
    | {
        getLogs?: (input: Record<string, unknown>) => Promise<any[]>;
        getTransactionReceipt?: (input: { hash: `0x${string}` }) => Promise<{ blockNumber?: bigint | number }>;
      }
    | undefined;
  const anchorContractAddress = eqty?.anchorContractAddress as `0x${string}` | undefined;

  if (!publicClient?.getLogs || !anchorContractAddress) {
    return {
      verified: anchorVerification.verified,
      anchorVerification,
      publicEvents: [],
      source: "local",
    };
  }

  const subjectId = Binary.fromHex(chain.id).hash().hex as `0x${string}`;
  const fromBlock = (await resolveAnchorFromBlock(publicClient, anchorVerification)) ?? 0n;
  const logs = await publicClient.getLogs({
    address: anchorContractAddress,
    event: PUBLIC_EVENT_ABI,
    fromBlock,
    args: {
      subjectId,
    },
  });

  return {
    verified: anchorVerification.verified,
    anchorVerification,
    publicEvents: logs.map(normalizeLocalPublicEvent),
    source: "local",
  };
}

export async function loadOwnableVerification(
  chain: EventChain,
  anchorVerification: AnchorValidationResult,
  eqty: any,
  hub?: HubService | null
): Promise<OwnableVerificationResult> {
  if (hub?.isConfigured) {
    try {
      const response = await fetch(verificationEndpoint(hub, chain.id));
      if (response.ok) {
        const verification = (await response.json()) as HubVerificationResponse;
        return {
          verified: verification.verified,
          anchorVerification: verification.anchorVerification,
          publicEvents: normalizeHubPublicEvents(verification.publicEvents),
          source: "hub",
        };
      }
      if (response.status !== 404) {
        throw new Error(`Hub verification lookup failed with status ${response.status}`);
      }
    } catch (error) {
      console.warn("Falling back to local ownable verification", error);
    }
  }

  return loadLocalOwnableVerification(chain, anchorVerification, eqty);
}
