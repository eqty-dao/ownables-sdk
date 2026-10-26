import { describe, expect, it } from "vitest";
import type { Event } from "eqty-core";
import {
  buildPublicEventTimeline,
  type TimelinePublicEvent,
} from "./publicEventTimeline";

function chainEvent(hash: string, data: Record<string, unknown> = {}): Event {
  return {
    hash: { hex: hash },
    parsedData: data,
  } as Event;
}

function trackedEvent(
  replayKey: string,
  overrides: Partial<TimelinePublicEvent> = {}
): TimelinePublicEvent {
  return {
    replayKey,
    event: {
      source: "0xsource",
      eventType: "drink",
      data: "0x01",
      blockNumber: 8,
      transactionHash: "0xaaa",
      transactionIndex: 1,
      logIndex: 0,
    },
    status: "pending",
    sources: ["local"],
    insertionAnchor: {
      privateEventCount: 1,
      privateEventHash: "private-one",
      ordinal: 0,
    },
    ...overrides,
  };
}

describe("buildPublicEventTimeline", () => {
  it("replaces a matching signed register event with one public timeline row", () => {
    const record = trackedEvent("0xaaa:0", { registerEventHash: "register" });
    const timeline = buildPublicEventTimeline(
      [chainEvent("private-one"), chainEvent("register", { "@context": "register_msg.json" })],
      [record]
    );

    expect(timeline.map((item) => item.key)).toEqual([
      "private:private-one",
      "public:0xaaa:0",
    ]);
  });

  it("uses register replay identity when legacy tracked metadata has no register hash", () => {
    const record = trackedEvent("0xaaa:2", {
      event: {
        source: "0xsource",
        eventType: "drink",
        data: "0x01",
        blockNumber: 8,
        transactionHash: "0xAaA",
        transactionIndex: 1,
        logIndex: 2,
      },
    });
    const timeline = buildPublicEventTimeline(
      [
        chainEvent("register", {
          "@context": "register_msg.json",
          transactionHash: "0xaaa",
          logIndex: 2,
        }),
      ],
      [record]
    );

    expect(timeline.map((item) => item.key)).toEqual(["public:0xaaa:2"]);
  });

  it("keeps a failed local replay in its anchored position and confirms the same key in place", () => {
    const events = [chainEvent("private-one"), chainEvent("private-two")];
    const failed = trackedEvent("0xfail:1", {
      event: {
        source: "0xsource",
        eventType: "drink",
        data: "0x01",
        blockNumber: 11,
        transactionHash: "0xfail",
        transactionIndex: 0,
        logIndex: 1,
      },
      localApplicationState: "failed",
      localDisplayError: "runtime unavailable",
    });
    const confirmed = { ...failed, status: "confirmed" as const, localDisplayError: undefined };

    const pendingTimeline = buildPublicEventTimeline(events, [failed]);
    const confirmedTimeline = buildPublicEventTimeline(events, [confirmed]);

    expect(pendingTimeline.map((item) => item.key)).toEqual(confirmedTimeline.map((item) => item.key));
    expect(pendingTimeline[1]).toMatchObject({ kind: "public", record: { status: "pending" } });
    expect(confirmedTimeline[1]).toMatchObject({ kind: "public", record: { status: "confirmed" } });
  });

  it("deduplicates replay keys and orders public records in an insertion interval by block, transaction, and log", () => {
    const first = trackedEvent("0xfirst:1", {
      event: {
        source: "0xsource",
        eventType: "first",
        data: "0x01",
        blockNumber: 9,
        transactionHash: "0xfirst",
        transactionIndex: 2,
        logIndex: 1,
      },
      insertionAnchor: { privateEventCount: 0, privateEventHash: "", ordinal: 1 },
    });
    const second = trackedEvent("0xsecond:0", {
      event: {
        source: "0xsource",
        eventType: "second",
        data: "0x01",
        blockNumber: 9,
        transactionHash: "0xsecond",
        transactionIndex: 2,
        logIndex: 0,
      },
      insertionAnchor: { privateEventCount: 0, privateEventHash: "", ordinal: 0 },
    });

    const timeline = buildPublicEventTimeline([chainEvent("private")], [first, second, { ...first, status: "confirmed" }]);

    expect(timeline.map((item) => item.key)).toEqual([
      "public:0xsecond:0",
      "public:0xfirst:1",
      "private:private",
    ]);
  });

  it("retains private event order and keeps the static-ownable empty state empty", () => {
    expect(buildPublicEventTimeline([], [])).toEqual([]);
    expect(buildPublicEventTimeline([chainEvent("one"), chainEvent("two")], []).map((item) => item.key)).toEqual([
      "private:one",
      "private:two",
    ]);
  });
});
