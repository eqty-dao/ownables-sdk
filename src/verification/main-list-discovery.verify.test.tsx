import type { ReactNode } from "react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import GetStarted from "@/components/GetStarted";
import OwnableList from "@/components/OwnableList";
import { useOwnables } from "@/hooks/useOwnables";
import HubService, {
  AVAILABLE_OWNABLES_UNAVAILABLE_MESSAGE,
} from "@/services/Hub.service";

const { serviceMap, accountState, enqueueSnackbar } = vi.hoisted(() => ({
  serviceMap: {} as Record<string, any>,
  accountState: {
    address: "0xabc",
    isConnected: true,
  },
  enqueueSnackbar: vi.fn(),
}));

vi.mock("notistack", () => ({
  enqueueSnackbar,
  SnackbarProvider: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@/hooks/useService", () => ({
  useService: (key: string) => serviceMap[key] ?? null,
}));

vi.mock("wagmi", () => ({
  useAccount: () => accountState,
  useChainId: () => 84532,
}));

vi.mock("@/contexts/Progress.context", () => ({
  useProgress: () => ({
    open: vi.fn(),
  }),
}));

vi.mock("@/contexts/Dialogs.context", () => ({
  useDialogs: () => ({
    showError: vi.fn(),
    showConfirm: vi.fn(),
    showAlert: vi.fn(),
  }),
}));

function createStorage(initialState: Record<string, any> = {}) {
  const values = { ...initialState };

  return {
    get: vi.fn((key: string) => values[key]),
    set: vi.fn((key: string, value: any) => {
      values[key] = value;
    }),
    remove: vi.fn((key: string) => {
      delete values[key];
    }),
  };
}

function MainListHarness() {
  const [selectedChainId, setSelectedChainId] = useState<string | null>(null);
  const {
    ownables,
    mainListEntries,
    mainListLoaded,
    hiddenAvailableOwnablesCount,
    importAvailableOwnable,
    dismissAvailableOwnable,
    resetDismissedAvailableOwnables,
  } = useOwnables({
    onSelect: setSelectedChainId,
  });

  return (
    <>
      <div data-testid="selected-chain-id">{selectedChainId ?? ""}</div>
      <div data-testid="imported-count">{String(ownables.length)}</div>
      {mainListLoaded && mainListEntries.length === 0 ? (
        <GetStarted onExamples={() => {}} />
      ) : null}
      <OwnableList
        entries={mainListEntries}
        selectedChainId={selectedChainId}
        issueSelected={false}
        hiddenOnMobile={false}
        consuming={null}
        consumeEligibility={{}}
        hiddenAvailableOwnablesCount={hiddenAvailableOwnablesCount}
        onSelect={setSelectedChainId}
        onConsume={() => {}}
        onIssue={() => {}}
        onImportAvailable={importAvailableOwnable}
        onDismissAvailable={dismissAvailableOwnable}
        onResetHiddenAvailable={resetDismissedAvailableOwnables}
      />
    </>
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });

  return { promise, resolve };
}

const ACCOUNT = "eip155:84532:0xabc";
const ACCOUNT_B = "eip155:84532:0xdef";
const DOWNLOAD_URL = "https://hub.example/ownables/bafy/download";
const AVAILABLE_ENTRY = {
  id: "available:account:bafy:1",
  cid: "bafy",
  title: "Potion",
  description: "Transferred to this wallet from Hub.",
  issuer: "0x1234567890abcdef1234567890abcdef12345678",
  downloadUrl: DOWNLOAD_URL,
  availableAt: "2026-06-08T12:34:56.000Z",
  thumbnailUrl: null,
};
const AVAILABLE_ENTRY_B = {
  id: "available:account:elixir:1",
  cid: "bafy-second",
  title: "Elixir",
  description: "Transferred to wallet B from Hub.",
  issuer: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
  downloadUrl: "https://hub.example/ownables/bafy-second/download",
  availableAt: "2026-06-08T12:40:56.000Z",
  thumbnailUrl: null,
};

function configureBaseServices(storage = createStorage()) {
  const importedPackage = {
    cid: "bafy",
    title: "Potion",
    chain: {
      id: "ownable-1",
      events: [{ signerAddress: "0x1234567890abcdef1234567890abcdef12345678" }],
    },
  };

  serviceMap.localStorage = storage;
  serviceMap.relay = {
    importFromRelay: vi.fn(),
    sendOwnable: vi.fn(),
    removeOwnable: vi.fn(),
  };
  serviceMap.packages = {
    info: vi.fn(() => ({
      title: "Potion",
      description: "Transferred to this wallet from Hub.",
      isConsumable: false,
      isLockable: false,
    })),
    importFromHub: vi.fn().mockResolvedValue(importedPackage),
  };
  serviceMap.ownables = {
    loadAll: vi.fn().mockResolvedValue([]),
    initWorker: vi.fn().mockResolvedValue(undefined),
    init: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn(),
    deleteAll: vi.fn(),
    clearRpc: vi.fn(),
    anchoring: false,
  };
  serviceMap.hub = {
    isConfigured: true,
    recipientDiscoveryEnabled: true,
    listAvailableOwnables: vi.fn().mockResolvedValue({
      owner: ACCOUNT,
      entries: [AVAILABLE_ENTRY],
    }),
    importFromHubUrl: vi.fn().mockResolvedValue(new File(["zip"], "ownable.zip")),
  };

  return { importedPackage, storage };
}

describe("main-list discovery verifier", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    Object.keys(serviceMap).forEach((key) => delete serviceMap[key]);
    accountState.address = "0xabc";
    accountState.isConnected = true;
  });

  it("renders available Hub rows in the main list and suppresses the empty state", async () => {
    configureBaseServices();

    const view = render(<MainListHarness />);

    expect(await screen.findByText("Available from Hub")).toBeTruthy();
    expect(await screen.findByText("Potion")).toBeTruthy();
    expect(screen.getByText("Available on Hub")).toBeTruthy();
    expect(screen.queryByText("Let's get started!")).toBeNull();
    expect(screen.queryByText("Notifications")).toBeNull();
    expect(serviceMap.hub.listAvailableOwnables).toHaveBeenCalledWith(ACCOUNT);
  });

  it("dismisses available rows per account, keeps them hidden after reload, and can restore them", async () => {
    const user = userEvent.setup();
    const { storage } = configureBaseServices();
    const dismissKey = `hub-available:dismissed:${ACCOUNT}`;

    const view = render(<MainListHarness />);

    await screen.findByText("Potion");
    await user.click(screen.getByRole("button", { name: "Dismiss" }));

    await waitFor(() => {
      expect(storage.set).toHaveBeenCalledWith(dismissKey, [AVAILABLE_ENTRY.id]);
    });
    expect(screen.queryByText("Potion")).toBeNull();
    expect(screen.getByRole("button", { name: "Show dismissed Hub items" })).toBeTruthy();

    view.unmount();

    render(<MainListHarness />);

    await screen.findByText("Available from Hub");
    expect(screen.queryByText("Potion")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Show dismissed Hub items" }));

    await waitFor(() => {
      expect(storage.remove).toHaveBeenCalledWith(dismissKey);
    });
    expect(await screen.findByText("Potion")).toBeTruthy();
  });

  it("clears previous-account available rows while the next account discovery fetch is in flight", async () => {
    const walletA = deferred<{ owner: string; entries: typeof AVAILABLE_ENTRY[] }>();
    const walletB = deferred<{ owner: string; entries: typeof AVAILABLE_ENTRY_B[] }>();
    const storage = createStorage({
      [`hub-available:dismissed:${ACCOUNT}`]: [AVAILABLE_ENTRY.id],
    });

    configureBaseServices(storage);
    serviceMap.hub.listAvailableOwnables = vi
      .fn()
      .mockImplementation((owner: string) => {
        if (owner === ACCOUNT) return walletA.promise;
        if (owner === ACCOUNT_B) return walletB.promise;
        throw new Error(`Unexpected owner ${owner}`);
      });

    const view = render(<MainListHarness />);

    walletA.resolve({ owner: ACCOUNT, entries: [AVAILABLE_ENTRY] });
    await screen.findByText("Available from Hub");
    expect(screen.queryByText("Potion")).toBeNull();
    expect(screen.getByRole("button", { name: "Show dismissed Hub items" })).toBeTruthy();

    accountState.address = "0xdef";

    view.rerender(<MainListHarness />);

    await waitFor(() => {
      expect(serviceMap.hub.listAvailableOwnables).toHaveBeenCalledWith(ACCOUNT_B);
    });
    expect(screen.queryByText("Potion")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Show dismissed Hub items" })
    ).toBeNull();

    walletB.resolve({ owner: ACCOUNT_B, entries: [AVAILABLE_ENTRY_B] });
    expect(await screen.findByText("Elixir")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Show dismissed Hub items" })).toBeNull();
  });

  it("imports through the Hub path, selects the imported ownable, and does not touch Relay receive helpers", async () => {
    const user = userEvent.setup();
    const { importedPackage } = configureBaseServices();

    render(<MainListHarness />);

    await screen.findByText("Potion");
    await user.click(screen.getByRole("button", { name: "Download & import" }));

    await waitFor(() => {
      expect(serviceMap.hub.importFromHubUrl).toHaveBeenCalledWith(DOWNLOAD_URL);
      expect(serviceMap.packages.importFromHub).toHaveBeenCalled();
      expect(serviceMap.ownables.init).toHaveBeenCalledWith(
        importedPackage.chain,
        importedPackage.cid
      );
    });

    expect(serviceMap.relay.importFromRelay).not.toHaveBeenCalled();
    expect(serviceMap.relay.sendOwnable).not.toHaveBeenCalled();
    expect((await screen.findByTestId("selected-chain-id")).textContent).toContain(
      "ownable-1"
    );
    expect((await screen.findByTestId("imported-count")).textContent).toContain("1");
    await waitFor(() => {
      expect(screen.queryByText("Available on Hub")).toBeNull();
    });
  });

  it("uses the ownables-scoped discovery route", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ owner: ACCOUNT, entries: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const hub = new HubService("https://hub.example");

    await hub.listAvailableOwnables(ACCOUNT);

    expect(fetchMock).toHaveBeenCalledWith(
      `https://hub.example/ownables/available?owner=${encodeURIComponent(ACCOUNT)}`
    );
  });

  it("guards Hub imports to the configured origin", async () => {
    const hub = new HubService("https://hub.example");

    expect(() => hub.parseHubDownloadUrl(DOWNLOAD_URL)).not.toThrow();
    expect(() =>
      hub.parseHubDownloadUrl("https://evil.example/ownables/bafy/download")
    ).toThrow("Hub download URL must use the configured Hub origin");
    expect(() => hub.parseHubDownloadUrl("not-a-url")).toThrow(
      "Hub download URL is malformed"
    );
  });

  it("maps missing discovery endpoints to the accepted unavailable message", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, { status: 404, statusText: "Not Found" })
    );
    vi.stubGlobal("fetch", fetchMock);
    const hub = new HubService("https://hub.example");

    await expect(hub.listAvailableOwnables(ACCOUNT)).rejects.toThrow(
      AVAILABLE_OWNABLES_UNAVAILABLE_MESSAGE
    );
  });
});
