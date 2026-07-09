import type { AnchorValidationResult, IndexedPublicEvent } from "@ownables/core";
import { publicEventReplayKey, selectReplayableIndexedPublicEvents } from "@ownables/core";
import type { EventChain, Event } from "eqty-core";

export interface TimelinePublicEvent extends IndexedPublicEvent {
  replayKey: string;
  replayStatus: "applied" | "ignored";
  ignoredReason?: string;
  payloadJson: unknown;
}

export type TimelineEntry =
  | {
      kind: "private";
      event: Event;
      anchorTx?: string;
      verified: boolean;
      isFirst: boolean;
    }
  | {
      kind: "public";
      event: TimelinePublicEvent;
    };

function privateEventsFromChain(chain: EventChain) {
  return chain.events.map((event: any) => ({
    hash: event.hash?.hex ?? event.hash,
    ...(typeof event.timestamp === "number" ? { timestamp: event.timestamp } : {}),
  }));
}

export function normalizeTimelinePublicEvent(
  event: Omit<TimelinePublicEvent, "replayKey"> & { replayKey?: string }
): TimelinePublicEvent {
  return {
    ...event,
    replayKey: event.replayKey ?? publicEventReplayKey(event),
  };
}

export function buildMixedTimelineEntries(
  chain: EventChain,
  anchorVerification: AnchorValidationResult,
  anchors: Array<{ tx: string | undefined; verified: boolean } | null>,
  publicEvents: TimelinePublicEvent[],
  mode: "production" | "development" = "production"
): TimelineEntry[] {
  const privateEntries: TimelineEntry[] = chain.events.map((event, index) => ({
    kind: "private",
    event,
    anchorTx: anchors[index]?.tx,
    verified: Boolean(anchors[index]?.verified),
    isFirst: index === 0,
  }));

  if (publicEvents.length === 0) {
    return privateEntries;
  }

  const buckets = Array.from(
    { length: chain.events.length + 1 },
    () => [] as TimelinePublicEvent[]
  );
  let remaining = [...publicEvents];
  const privateEvents = privateEventsFromChain(chain);

  for (let privatePrefixLength = 0; privatePrefixLength <= chain.events.length; privatePrefixLength += 1) {
    if (remaining.length === 0) break;

    const selected = selectReplayableIndexedPublicEvents(remaining, {
      privateEvents,
      privatePrefixLength,
      anchorValidation: anchorVerification,
      mode,
    });
    const replayableKeys = new Set(
      selected.events.map((event) => publicEventReplayKey(event))
    );
    if (replayableKeys.size === 0) continue;

    buckets[privatePrefixLength].push(
      ...remaining.filter((event) => replayableKeys.has(event.replayKey))
    );
    remaining = remaining.filter((event) => !replayableKeys.has(event.replayKey));
  }

  const timeline: TimelineEntry[] = [];
  if (buckets[0]) {
    timeline.push(...buckets[0].map((event) => ({ kind: "public" as const, event })));
  }

  privateEntries.forEach((entry, index) => {
    timeline.push(entry);
    const afterPrivate = buckets[index + 1] ?? [];
    timeline.push(...afterPrivate.map((event) => ({ kind: "public" as const, event })));
  });

  if (remaining.length > 0) {
    timeline.push(...remaining.map((event) => ({ kind: "public" as const, event })));
  }

  return timeline;
}
