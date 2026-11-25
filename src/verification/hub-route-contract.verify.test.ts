import { describe, expect, it, vi } from "vitest";
import * as PlatformBrowser from "@ownables/platform-browser";

const { HubService } = PlatformBrowser as any as {
  HubService: new (
    url: string,
    network: "base" | "base-sepolia",
    fetchFn?: (input: string, init?: RequestInit) => Promise<Response>,
    eventSourceFactory?: (url: string) => HubEventSourceLike
  ) => HubServiceLike;
};

interface HubEventSourceLike {
  addEventListener(type: string, listener: (event: { data?: string }) => void): void;
  removeEventListener(type: string, listener: (event: { data?: string }) => void): void;
  close(): void;
  onerror: ((event: unknown) => void) | null;
}

interface HubServiceLike {
  uploadOwnable(
    content: Uint8Array,
    filename?: string
  ): Promise<{ cid: string; owner?: string }>;
  downloadOwnable(ownableId: string): Promise<File>;
  loadOwnablePublicEvents(ownableId: string): Promise<unknown>;
  listAvailableOwnables(address: string): Promise<unknown>;
  watchAvailableOwnables(
    address: string,
    handlers: { onEvent: (message: unknown) => void; onError?: (error: unknown) => void }
  ): { close(): void };
  watchOwnablePublicEvents(
    ownableIds: string[],
    handlers: { onEvent: (message: unknown) => void; onError?: (error: unknown) => void },
    options?: { fromBlock?: string | number | bigint }
  ): { close(): void };
}

const HUB_URL = "https://hub.example";
const ADDRESS = "0x1111111111111111111111111111111111111111";
const ACCOUNT = `eip155:84532:${ADDRESS}`;
const OWNABLE_ID = "ownable/with space";

function createEventSource(url: string) {
  const addEventListener = vi.fn();
  const removeEventListener = vi.fn();
  const close = vi.fn();

  return {
    url,
    addEventListener,
    removeEventListener,
    close,
    onerror: null as ((event: unknown) => void) | null,
  };
}

describe("Hub route contract", () => {
  it("uses canonical upload, bundle, snapshot, and account discovery routes", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ cid: "bafy-uploaded" }), {
          status: 201,
          headers: { "content-type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(new Blob(["zip-bytes"], { type: "application/zip" }), {
          status: 200,
          headers: { "content-type": "application/zip" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ownableId: OWNABLE_ID, publicEvents: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ owner: ACCOUNT, entries: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      );
    const hub = new HubService(HUB_URL, "base-sepolia", fetchFn);

    await hub.uploadOwnable(new Uint8Array([1, 2, 3]), "dossier.zip");
    await hub.downloadOwnable(OWNABLE_ID);
    await hub.loadOwnablePublicEvents(OWNABLE_ID);
    await hub.listAvailableOwnables(ADDRESS);

    expect(fetchFn.mock.calls[0]?.[0]).toBe(`${HUB_URL}/base-sepolia/ownables`);
    expect(fetchFn.mock.calls[0]?.[1]?.method).toBe("POST");
    expect(fetchFn.mock.calls[0]?.[1]?.body).toBeInstanceOf(FormData);
    const body = fetchFn.mock.calls[0]?.[1]?.body as FormData;
    const uploadedFile = body.get("file");
    expect(uploadedFile).toBeInstanceOf(File);
    expect((uploadedFile as File).name).toBe("dossier.zip");
    expect(body.getAll("file")).toHaveLength(1);
    expect(fetchFn).toHaveBeenNthCalledWith(
      2,
      `${HUB_URL}/base-sepolia/ownables/${encodeURIComponent(OWNABLE_ID)}/bundle`
    );
    expect(fetchFn).toHaveBeenNthCalledWith(
      3,
      `${HUB_URL}/base-sepolia/ownables/${encodeURIComponent(OWNABLE_ID)}/public-events`
    );
    expect(fetchFn).toHaveBeenNthCalledWith(
      4,
      `${HUB_URL}/base-sepolia/inbox/${encodeURIComponent(ADDRESS)}`
    );
  });

  it("uses filtered canonical SSE routes and releases each listener once", () => {
    const streams: ReturnType<typeof createEventSource>[] = [];
    const eventSourceFactory = vi.fn((url: string) => {
      const stream = createEventSource(url);
      streams.push(stream);
      return stream;
    });
    const hub = new HubService(HUB_URL, "base-sepolia", vi.fn(), eventSourceFactory);
    const onAvailable = vi.fn();
    const onPublicEvent = vi.fn();

    const availableSubscription = hub.watchAvailableOwnables(ADDRESS, { onEvent: onAvailable });
    const publicEventsSubscription = hub.watchOwnablePublicEvents(
      [OWNABLE_ID, "second?ownable"],
      { onEvent: onPublicEvent },
      { fromBlock: 0 }
    );

    expect(streams.map((stream) => stream.url)).toEqual([
      `${HUB_URL}/base-sepolia/streams/inbox/${encodeURIComponent(ADDRESS)}`,
      `${HUB_URL}/base-sepolia/streams/public-events?ownableId=ownable%2Fwith+space&ownableId=second%3Fownable&fromBlock=0`,
    ]);
    expect(streams[0]?.addEventListener).toHaveBeenCalledWith(
      "available-ownable",
      expect.any(Function)
    );
    expect(streams[1]?.addEventListener).toHaveBeenCalledWith(
      "public-event",
      expect.any(Function)
    );

    availableSubscription.close();
    publicEventsSubscription.close();

    expect(streams[0]?.removeEventListener).toHaveBeenCalledWith(
      "available-ownable",
      expect.any(Function)
    );
    expect(streams[1]?.removeEventListener).toHaveBeenCalledWith(
      "public-event",
      expect.any(Function)
    );
    expect(streams[0]?.close).toHaveBeenCalledOnce();
    expect(streams[1]?.close).toHaveBeenCalledOnce();
  });

  it("rejects an unfiltered public-events stream before opening EventSource", () => {
    const eventSourceFactory = vi.fn((url: string) => createEventSource(url));
    const hub = new HubService(HUB_URL, "base-sepolia", vi.fn(), eventSourceFactory);

    expect(() => hub.watchOwnablePublicEvents([], { onEvent: vi.fn() })).toThrow(
      "At least one ownable ID is required to watch public events"
    );
    expect(eventSourceFactory).not.toHaveBeenCalled();
  });

  it("uses the Base Mainnet prefix when its Hub client is selected", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ owner: `eip155:8453:${ADDRESS}`, entries: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    const hub = new HubService(HUB_URL, "base", fetchFn);

    await hub.listAvailableOwnables(ADDRESS);

    expect(fetchFn).toHaveBeenCalledWith(`${HUB_URL}/base/inbox/${ADDRESS}`);
  });
});
