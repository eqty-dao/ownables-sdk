import type { ReactNode } from "react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EventChain } from "eqty-core";
import GetStarted from "@/components/GetStarted";
import MainSection from "@/components/MainSection";
import OwnableList from "@/components/OwnableList";
import Sidebar from "@/components/Sidebar";
import { useOwnableState } from "@/hooks/useOwnableState";
import { useOwnableTransfer } from "@/hooks/useOwnableTransfer";
import { useOwnables } from "@/hooks/useOwnables";
import HubService, {
  AVAILABLE_OWNABLES_UNAVAILABLE_MESSAGE,
} from "@/services/Hub.service";

const { serviceMap, accountState, e2eState, enqueueSnackbar, progressOpen, progressClose, disconnectMock } = vi.hoisted(() => ({
  serviceMap: {} as Record<string, any>,
  accountState: {
    address: "0xabc",
    isConnected: true,
    isConnecting: false,
  },
  e2eState: {
    enabled: false,
    address: "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
  },
  enqueueSnackbar: vi.fn(),
  progressOpen: vi.fn(),
  progressClose: vi.fn(),
  disconnectMock: vi.fn(),
}));

vi.mock("notistack", () => ({
  enqueueSnackbar,
  SnackbarProvider: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@/hooks/useService", () => ({
  useService: (key: string) => serviceMap[key] ?? null,
}));

vi.mock("@/utils/isE2E", () => ({
  get isE2E() {
    return e2eState.enabled;
  },
}));

vi.mock("@/services/E2EWallet", () => ({
  getE2EAccount: () => ({
    address: e2eState.address,
  }),
}));

vi.mock("wagmi", () => ({
  useAccount: () => accountState,
  useChainId: () => 84532,
  useDisconnect: () => ({
    disconnect: disconnectMock,
    isPending: false,
  }),
}));

vi.mock("@/components/NetworkBadge", () => ({
  default: () => <div data-testid="network-badge" />,
}));

vi.mock("@/components/WalletAddress", () => ({
  default: () => <div data-testid="wallet-address" />,
}));

vi.mock("@/components/WalletBalance", () => ({
  default: () => <div data-testid="wallet-balance" />,
}));

vi.mock("@/components/ThemePicker", () => ({
  default: () => <div data-testid="theme-picker" />,
}));

vi.mock("@/contexts/Progress.context", () => ({
  useProgress: () => ({
    open: progressOpen,
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
    archivedEntries,
    mainListEntries,
    mainListLoaded,
    archivedOwnablesCount,
    importAvailableOwnable,
    archiveOwnable,
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
        archivedEntries={archivedEntries}
        archivedOwnablesCount={archivedOwnablesCount}
        onSelect={setSelectedChainId}
        onConsume={() => {}}
        onIssue={() => {}}
        onImportAvailable={importAvailableOwnable}
      />
    </>
  );
}

function TransferHarness({
  chain,
  pkg,
  execute,
}: {
  chain: EventChain;
  pkg: { uniqueMessageHash?: string } | undefined;
  execute: (msg: any, onProgress?: any, submitAnchors?: boolean) => Promise<void>;
}) {
  const { transfer } = useOwnableTransfer(chain, pkg as any, execute);

  return (
    <button type="button" onClick={() => void transfer("0xdef")}>
      Transfer
    </button>
  );
}

function AvailableDetailHarness() {
  return (
      <MainSection
        ownables={[]}
        availableOwnables={[AVAILABLE_ENTRY]}
        archivedAvailableOwnables={[]}
        selectedEntryId={AVAILABLE_ENTRY.id}
        showIssuePanel={false}
        showDetail={true}
        consuming={null}
        consumeEligibility={{}}
        onArchive={vi.fn()}
        onRestore={vi.fn()}
        onBack={vi.fn()}
        onConsume={vi.fn()}
        onConsumeComplete={vi.fn()}
        onDelete={vi.fn()}
        onDeleteArchived={vi.fn()}
        onImportAvailable={vi.fn()}
        onArchiveAvailable={vi.fn()}
        onError={vi.fn()}
        onForge={vi.fn()}
        onCreate={vi.fn()}
    />
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
const CHAIN_ID = "00".repeat(32);
const AVAILABLE_ENTRY = {
  id: "0x11",
  title: "Potion",
  description: "Transferred to this wallet from Hub.",
  issuer: "0x1234567890abcdef1234567890abcdef12345678",
  availableAt: "2026-06-08T12:34:56.000Z",
  package: {
    cid: "bafy",
    thumbnailUrl: null,
  },
};
const AVAILABLE_ENTRY_B = {
  id: "0x22",
  title: "Elixir",
  description: "Transferred to wallet B from Hub.",
  issuer: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
  availableAt: "2026-06-08T12:40:56.000Z",
  package: {
    cid: "bafy-second",
    thumbnailUrl: null,
  },
};

function configureBaseServices(storage = createStorage()) {
  const importedPackage = {
    cid: "bafy",
    title: "Potion",
    chain: {
      id: AVAILABLE_ENTRY.id,
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
    listAvailableOwnables: vi.fn().mockResolvedValue({
      owner: ACCOUNT,
      entries: [AVAILABLE_ENTRY],
    }),
    importFromHub: vi.fn().mockResolvedValue({
      packageFile: new File(["zip"], "ownable.zip"),
      chainJson: { id: AVAILABLE_ENTRY.id },
    }),
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
    accountState.isConnecting = false;
    e2eState.enabled = false;
    e2eState.address = "0x70997970c51812dc3a010c7d01b50e0d17dc79c8";
    progressOpen.mockReturnValue([{ close: progressClose }, vi.fn()]);
  });

  it("renders available Hub rows in the main list and suppresses the empty state", async () => {
    configureBaseServices();

    render(<MainListHarness />);

    expect(await screen.findByText("Potion")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Import Potion" })).toBeTruthy();
    expect(screen.queryByText("Let's get started!")).toBeNull();
    expect(screen.queryByText("Notifications")).toBeNull();
    expect(screen.queryByText("Available from Hub")).toBeNull();
    expect(serviceMap.hub.listAvailableOwnables).toHaveBeenCalledWith(ACCOUNT);
  });

  it("selects an available Hub row from the main list", async () => {
    const user = userEvent.setup();
    configureBaseServices();

    render(<MainListHarness />);

    await user.click(await screen.findByText("Potion"));

    expect(screen.getByTestId("selected-chain-id").textContent).toContain(
      AVAILABLE_ENTRY.id
    );
  });

  it("renders the pre-import detail surface for a selected available ownable", async () => {
    render(<AvailableDetailHarness />);

    expect(screen.getByRole("button", { name: "Import from Hub" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Archive" })).toBeTruthy();
    expect(screen.getByText("About")).toBeTruthy();
    expect(screen.getByText("Transferred to this wallet from Hub.")).toBeTruthy();
  });

  it("keeps settings in connected state throughout E2E mode", async () => {
    e2eState.enabled = true;
    accountState.isConnected = false;
    serviceMap.eventChains = {
      anchoring: false,
      setAnchoring: vi.fn(),
    };

    render(
      <Sidebar
        open={true}
        onClose={vi.fn()}
        onReset={vi.fn()}
        onFactoryReset={vi.fn()}
      />
    );

    expect(screen.queryByRole("button", { name: "Connect to wallet" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "DISCONNECT" }).hasAttribute("disabled")
    ).toBe(true);
  });

  it("shows loading state while importing from Hub", async () => {
    render(
      <MainSection
        ownables={[]}
        availableOwnables={[AVAILABLE_ENTRY]}
        archivedAvailableOwnables={[]}
        selectedEntryId={AVAILABLE_ENTRY.id}
        showIssuePanel={false}
        showDetail={true}
        consuming={null}
        consumeEligibility={{}}
        importingAvailableOwnableId={AVAILABLE_ENTRY.id}
        onArchive={vi.fn()}
        onRestore={vi.fn()}
        onBack={vi.fn()}
        onConsume={vi.fn()}
        onConsumeComplete={vi.fn()}
        onDelete={vi.fn()}
        onDeleteArchived={vi.fn()}
        onImportAvailable={vi.fn()}
        onArchiveAvailable={vi.fn()}
        onError={vi.fn()}
        onForge={vi.fn()}
        onCreate={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Import from Hub" })).toHaveProperty("disabled", true);
    expect(screen.getByText("Importing from Hub")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Archive" })).toHaveProperty("disabled", true);
  });

  it("archives available rows per account, keeps them hidden after reload, and can restore them", async () => {
    const user = userEvent.setup();
    const { storage } = configureBaseServices();
    const archiveKey = `ownables:archived:${ACCOUNT}`;
    const { result, unmount } = renderHook(() =>
      useOwnables({
        onSelect: vi.fn(),
      })
    );

    await waitFor(() => {
      expect(result.current.availableOwnables).toHaveLength(1);
    });

    act(() => {
      result.current.archiveOwnable(AVAILABLE_ENTRY.id);
    });

    await waitFor(() => {
      expect(storage.set).toHaveBeenCalledWith(archiveKey, [AVAILABLE_ENTRY.id]);
    });

    unmount();
    render(<MainListHarness />);

    await waitFor(() => {
      expect(serviceMap.hub.listAvailableOwnables).toHaveBeenCalledWith(ACCOUNT);
    });
    expect(screen.queryByText("Potion")).toBeNull();
    expect(screen.getByRole("button", { name: /Archived/ })).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText("Archived")).toBeTruthy();
    });

    const restored = renderHook(() =>
      useOwnables({
        onSelect: vi.fn(),
      })
    );

    act(() => {
      restored.result.current.restoreArchivedOwnable(AVAILABLE_ENTRY.id);
    });

    await waitFor(() => {
      expect(storage.remove).toHaveBeenCalledWith(archiveKey);
    });
  });

  it("clears previous-account available rows while the next account discovery fetch is in flight", async () => {
    const walletA = deferred<{ owner: string; entries: typeof AVAILABLE_ENTRY[] }>();
    const walletB = deferred<{ owner: string; entries: typeof AVAILABLE_ENTRY_B[] }>();
    const storage = createStorage({
      [`ownables:archived:${ACCOUNT}`]: [AVAILABLE_ENTRY.id],
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
    await screen.findByRole("button", { name: /Archived/ });
    expect(screen.queryByText("Potion")).toBeNull();
    expect(screen.getByRole("button", { name: /Archived/ })).toBeTruthy();

    accountState.address = "0xdef";

    view.rerender(<MainListHarness />);

    await waitFor(() => {
      expect(serviceMap.hub.listAvailableOwnables).toHaveBeenCalledWith(ACCOUNT_B);
    });
    expect(screen.queryByText("Potion")).toBeNull();
    expect(screen.queryByRole("button", { name: /Archived/ })).toBeNull();

    walletB.resolve({ owner: ACCOUNT_B, entries: [AVAILABLE_ENTRY_B] });
    expect(await screen.findByText("Elixir")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Archived/ })).toBeNull();
  });

  it("uses the E2E account for Hub discovery even when wagmi is not connected yet", async () => {
    e2eState.enabled = true;
    accountState.address = undefined as unknown as string;
    accountState.isConnected = false;

    configureBaseServices();
    serviceMap.hub.listAvailableOwnables = vi.fn().mockResolvedValue({
      owner: `eip155:84532:${e2eState.address}`,
      entries: [AVAILABLE_ENTRY_B],
    });

    render(<MainListHarness />);

    expect(await screen.findByText("Elixir")).toBeTruthy();
    expect(serviceMap.hub.listAvailableOwnables).toHaveBeenCalledWith(
      `eip155:84532:${e2eState.address}`
    );
  });

  it("refreshes Hub-available ownables when the tab regains focus", async () => {
    configureBaseServices();
    serviceMap.hub.listAvailableOwnables = vi
      .fn()
      .mockResolvedValueOnce({
        owner: ACCOUNT,
        entries: [AVAILABLE_ENTRY],
      })
      .mockResolvedValue({
        owner: ACCOUNT,
        entries: [AVAILABLE_ENTRY, AVAILABLE_ENTRY_B],
      });

    render(<MainListHarness />);

    expect(await screen.findByText("Potion")).toBeTruthy();
    expect(serviceMap.hub.listAvailableOwnables).toHaveBeenCalledTimes(1);

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      await Promise.resolve();
    });

    expect(await screen.findByText("Elixir")).toBeTruthy();
    expect(serviceMap.hub.listAvailableOwnables).toHaveBeenCalledTimes(2);
  });

  it("imports through the Hub path, selects the imported ownable, and does not touch Relay receive helpers", async () => {
    const user = userEvent.setup();
    const { importedPackage } = configureBaseServices();

    render(<MainListHarness />);

    await screen.findByText("Potion");
    await user.click(screen.getByRole("button", { name: "Import Potion" }));

    await waitFor(() => {
      expect(serviceMap.hub.importFromHub).toHaveBeenCalledWith(
        AVAILABLE_ENTRY.package.cid,
        AVAILABLE_ENTRY.id
      );
      expect(serviceMap.packages.importFromHub).toHaveBeenCalledWith(
        expect.any(File),
        { id: AVAILABLE_ENTRY.id }
      );
      expect(serviceMap.ownables.init).toHaveBeenCalledWith(
        importedPackage.chain,
        importedPackage.cid
      );
    });

    expect(serviceMap.relay.importFromRelay).not.toHaveBeenCalled();
    expect(serviceMap.relay.sendOwnable).not.toHaveBeenCalled();
    expect((await screen.findByTestId("selected-chain-id")).textContent).toContain(
      AVAILABLE_ENTRY.id
    );
    expect((await screen.findByTestId("imported-count")).textContent).toContain("1");
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Import Potion" })).toBeNull();
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

    expect(() => hub.parseHubDownloadUrl(hub.getPackageDownloadUrl(AVAILABLE_ENTRY.package.cid))).not.toThrow();
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

  it("rethrows ownable execution failures after surfacing the ownable error", async () => {
    const chain = new EventChain(CHAIN_ID);
    const executeError = new Error(
      "UNKNOWN kind: Other, error: type: bool; key: [69, 73, 5F, 6C, 6F, 63, 6B, 65, 64] not found"
    );
    const onError = vi.fn();

    serviceMap.ownables = {
      isReady: vi.fn().mockReturnValue(false),
      execute: vi.fn().mockRejectedValue(executeError),
      submitAnchors: vi.fn(),
      rpc: vi.fn(),
      setWidgetWindow: vi.fn(),
    };
    serviceMap.eventChains = {
      getStateDump: vi.fn(),
    };
    serviceMap.eqty = {
      address: "0xabc",
    };

    const { result } = renderHook(() =>
      useOwnableState(chain, undefined, onError)
    );

    await act(async () => {
      await expect(
        result.current.execute({ transfer: { to: "0xdef" } }, undefined, false)
      ).rejects.toBe(executeError);
    });

    expect(onError).toHaveBeenCalledWith(
      "The Ownable returned an error",
      expect.stringContaining("type: bool")
    );
  });

  it("does not upload to Hub when transfer execution fails before upload", async () => {
    const user = userEvent.setup();
    const chain = new EventChain(CHAIN_ID);
    const execute = vi.fn().mockRejectedValue(new Error("execute failed"));

    serviceMap.ownables = {
      anchoring: true,
      zip: vi.fn(),
      submitAnchors: vi.fn(),
      delete: vi.fn(),
    };
    serviceMap.hub = {
      isAvailable: vi.fn().mockResolvedValue(true),
      uploadOwnable: vi.fn(),
    };

    render(
      <TransferHarness
        chain={chain}
        pkg={{ uniqueMessageHash: "message-hash" }}
        execute={execute}
      />
    );

    await user.click(screen.getByRole("button", { name: "Transfer" }));

    await waitFor(() => {
      expect(execute).toHaveBeenCalledWith(
        { transfer: { to: "0xdef" } },
        expect.any(Function),
        false
      );
    });

    expect(progressOpen).toHaveBeenCalledWith({
      title: "Transferring Ownable",
      steps: [
        { id: "signEvent", label: "Sign the event" },
        { id: "hubUpload", label: "Upload to Hub" },
        { id: "anchor", label: "Anchor the event" },
      ],
    });
    expect(serviceMap.ownables.zip).not.toHaveBeenCalled();
    expect(serviceMap.hub.uploadOwnable).not.toHaveBeenCalled();
    expect(serviceMap.ownables.submitAnchors).not.toHaveBeenCalled();
    expect(serviceMap.ownables.delete).not.toHaveBeenCalled();
    expect(enqueueSnackbar).toHaveBeenCalledWith("Transfer failed: execute failed", {
      variant: "error",
    });
  });
});
