import type { ReconciledPublicEvent } from "@ownables/core";
import type { Event } from "eqty-core";

/**
 * Fields added by the Story #1 core replay contract. The published 0.10.0
 * package does not declare them yet, so keep this presentation-only extension
 * local until the SDK consumes the released core artifact.
 */
export type TimelinePublicEvent = ReconciledPublicEvent & {
  localApplicationState?: "pending" | "applied" | "failed";
  localDisplayError?: string;
  insertionAnchor?: {
    privateEventCount: number;
    privateEventHash: string;
    ordinal: number;
  };
  registerEventHash?: string;
};

export type TimelineItem =
  | {
      kind: "private";
      key: string;
      event: Event;
      chainIndex: number;
    }
  | {
      kind: "public";
      key: string;
      record: TimelinePublicEvent;
    };

type RegisterEventData = {
  "@context"?: string;
  transactionHash?: string;
  logIndex?: number | string;
};

function eventHash(event: Event): string {
  return event.hash?.hex ?? "";
}

function normalizeTransactionHash(value: string | undefined): string | undefined {
  return value?.toLowerCase();
}

function replayIdentity(transactionHash: string | undefined, logIndex: number | string | undefined) {
  if (transactionHash === undefined || logIndex === undefined) return undefined;
  return `${normalizeTransactionHash(transactionHash)}:${String(logIndex)}`;
}

function recordReplayIdentity(record: TimelinePublicEvent): string | undefined {
  return replayIdentity(record.event.transactionHash, record.event.logIndex);
}

function isRegisterEvent(event: Event): event is Event & { parsedData: RegisterEventData } {
  const data = event.parsedData as RegisterEventData | undefined;
  return data?.["@context"] === "register_msg.json";
}

function isSameReplayIdentity(event: Event, record: TimelinePublicEvent): boolean {
  if (!isRegisterEvent(event)) return false;

  const eventIdentity = replayIdentity(event.parsedData.transactionHash, event.parsedData.logIndex);
  const recordIdentity = recordReplayIdentity(record);
  return eventIdentity !== undefined && eventIdentity === recordIdentity;
}

function comparePublicEvents(left: TimelinePublicEvent, right: TimelinePublicEvent): number {
  const byBlock = left.event.blockNumber - right.event.blockNumber;
  if (byBlock !== 0) return byBlock;

  const byTransaction = left.event.transactionIndex - right.event.transactionIndex;
  if (byTransaction !== 0) return byTransaction;

  const byLog = left.event.logIndex - right.event.logIndex;
  if (byLog !== 0) return byLog;

  const byOrdinal =
    (left.insertionAnchor?.ordinal ?? Number.MAX_SAFE_INTEGER) -
    (right.insertionAnchor?.ordinal ?? Number.MAX_SAFE_INTEGER);
  if (byOrdinal !== 0) return byOrdinal;

  return left.replayKey.localeCompare(right.replayKey);
}

function uniqueTrackedRecords(records: readonly TimelinePublicEvent[]): TimelinePublicEvent[] {
  const byReplayKey = new Map<string, TimelinePublicEvent>();

  for (const record of records) {
    const current = byReplayKey.get(record.replayKey);
    if (!current || (current.status === "pending" && record.status === "confirmed")) {
      byReplayKey.set(record.replayKey, record);
    }
  }

  return [...byReplayKey.values()];
}

function findRegisteredRecord(
  event: Event,
  records: readonly TimelinePublicEvent[],
  usedReplayKeys: ReadonlySet<string>
): TimelinePublicEvent | undefined {
  const hash = eventHash(event);
  return records.find(
    (record) =>
      !usedReplayKeys.has(record.replayKey) &&
      (record.registerEventHash === hash || isSameReplayIdentity(event, record))
  );
}

function anchorIndex(record: TimelinePublicEvent, eventCount: number): number {
  const index = record.insertionAnchor?.privateEventCount;
  if (index === undefined) return eventCount;
  return Math.max(0, Math.min(index, eventCount));
}

/**
 * Builds the More information render model without changing chain or replay
 * persistence. Chain order is retained for signed events. Tracked records that
 * have no signed register event use the stable insertion anchor supplied by
 * core, then indexed block, transaction and log positions within that slot.
 */
export function buildPublicEventTimeline(
  events: readonly Event[],
  trackedPublicEvents: readonly TimelinePublicEvent[] = []
): TimelineItem[] {
  const records = uniqueTrackedRecords(trackedPublicEvents);
  const usedReplayKeys = new Set<string>();
  const registeredByChainIndex = new Map<number, TimelinePublicEvent>();
  const pendingByAnchor = new Map<number, TimelinePublicEvent[]>();

  for (const [chainIndex, event] of events.entries()) {
    const registeredRecord = findRegisteredRecord(event, records, usedReplayKeys);
    if (registeredRecord) {
      usedReplayKeys.add(registeredRecord.replayKey);
      registeredByChainIndex.set(chainIndex, registeredRecord);
    }
  }

  for (const record of records) {
    if (usedReplayKeys.has(record.replayKey)) continue;
    const index = anchorIndex(record, events.length);
    const bucket = pendingByAnchor.get(index) ?? [];
    bucket.push(record);
    pendingByAnchor.set(index, bucket);
  }

  for (const recordsAtAnchor of pendingByAnchor.values()) {
    recordsAtAnchor.sort(comparePublicEvents);
  }

  const timeline: TimelineItem[] = [];
  const appendUnregistered = (index: number) => {
    for (const record of pendingByAnchor.get(index) ?? []) {
      if (!usedReplayKeys.has(record.replayKey)) {
        usedReplayKeys.add(record.replayKey);
        timeline.push({ kind: "public", key: `public:${record.replayKey}`, record });
      }
    }
  };

  for (const [chainIndex, event] of events.entries()) {
    appendUnregistered(chainIndex);

    const registeredRecord = registeredByChainIndex.get(chainIndex);
    if (registeredRecord) {
      timeline.push({
        kind: "public",
        key: `public:${registeredRecord.replayKey}`,
        record: registeredRecord,
      });
      continue;
    }

    timeline.push({
      kind: "private",
      key: `private:${eventHash(event) || chainIndex}`,
      event,
      chainIndex,
    });
  }

  appendUnregistered(events.length);
  return timeline;
}
