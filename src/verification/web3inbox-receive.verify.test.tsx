import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NotificationsDrawer from "@/components/NotificationsDrawer";
import { useOwnables } from "@/hooks/useOwnables";
import { useOwnableTransfer } from "@/hooks/useOwnableTransfer";
import { LOCAL_DEVELOPER_DISCOVERY_UNAVAILABLE_MESSAGE } from "@/services/Hub.service";

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
    open: vi.fn(() => [{ close: vi.fn() }, vi.fn()]),
  }),
}));

vi.mock("@/contexts/Dialogs.context", () => ({
  useDialogs: () => ({
    showError: vi.fn(),
    showConfirm: vi.fn(),
    showAlert: vi.fn(),
  }),
}));

function OwnablesHarness({ importedPackage }: { importedPackage: any }) {
  const { ownables, loaded, addImportedOwnable } = useOwnables({
    onSelect: () => {},
  });

  return (
    <>
      <div data-testid="loaded">{loaded ? "loaded" : "loading"}</div>
      <div data-testid="ownable-count">{String(ownables.length)}</div>
      <button onClick={() => void addImportedOwnable(importedPackage)}>
        Import persisted ownable
      </button>
    </>
  );
}

function TransferHarness({
  chain,
  pkg,
  execute,
}: {
  chain: any;
  pkg: any;
  execute: any;
}) {
  const { transfer } = useOwnableTransfer(chain, pkg, execute);
  return <button onClick={() => void transfer("0xdef")}>Transfer</button>;
}

const ACCOUNT = "eip155:84532:0xabc";
const CANONICAL_URL = "https://hub.example/ownables/bafy/download";
const CANONICAL_KEY = `ownables.v1.available|${CANONICAL_URL}`;

function createNotification(overrides: Record<string, any> = {}) {
  return {
    id: "notif-1",
    title: "Transfer ready",
    body: "Import your Ownable from Hub",
    sentAt: "2026-06-06T12:34:56.000Z",
    url: CANONICAL_URL,
    isRead: false,
    type: "ownables.v1.available",
    read: vi.fn(),
    ...overrides,
  };
}

function createLocalNotification(overrides: Record<string, any> = {}) {
  return {
    id: "localdev:1",
    scope: "local-dev",
    title: "Ownable available on localhost",
    body: "Import this Ownable from your local Hub.",
    sentAt: "2026-06-06T12:34:56.000Z",
    url: CANONICAL_URL,
    type: "ownables.v1.available",
    ...overrides,
  };
}

function createNotificationsService(overrides: Record<string, any> = {}) {
  return {
    isConfigured: true,
    configurationError: () => null,
    toAccount: () => ACCOUNT,
    getRegistrationStatus: vi.fn().mockResolvedValue(true),
    watchSubscription: vi.fn().mockImplementation(async (_account, cb) => {
      cb({ unreadNotificationCount: 1 });
      return () => {};
    }),
    pageNotifications: vi.fn().mockImplementation(async (_account, onUpdate) => {
      const data = {
        notifications: [],
        hasMore: false,
        hasMoreUnread: false,
      };
      onUpdate(data);
      return {
        data,
        nextPage: vi.fn(),
        stopWatchingNotifications: vi.fn(),
      };
    }),
    markNotificationsAsRead: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
    ...overrides,
  };
}

function createStorage(initialState: Record<string, any> = {}) {
  const values = { ...initialState };

  return {
    values,
    get: vi.fn((key: string) => values[key]),
    set: vi.fn((key: string, value: any) => {
      values[key] = value;
    }),
  };
}

function renderDrawer(props: Record<string, any> = {}) {
  return render(
    <NotificationsDrawer
      open={true}
      onClose={() => {}}
      onImported={vi.fn().mockResolvedValue(undefined)}
      {...props}
    />
  );
}

describe("web3inbox receive verifier", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(serviceMap).forEach((key) => delete serviceMap[key]);
    accountState.address = "0xabc";
    accountState.isConnected = true;
  });

  it("keeps the drawer Web3Inbox-only when local developer notifications are disabled", async () => {
    const web3InboxNotification = createNotification();
    const notificationsService = createNotificationsService({
      pageNotifications: vi.fn().mockImplementation(async (_account, onUpdate) => {
        const data = {
          notifications: [web3InboxNotification],
          hasMore: false,
          hasMoreUnread: false,
        };
        onUpdate(data);
        return {
          data,
          nextPage: vi.fn(),
          stopWatchingNotifications: vi.fn(),
        };
      }),
    });
    const localDiscovery = vi.fn();

    serviceMap.notifications = notificationsService;
    serviceMap.hub = {
      localDeveloperNotificationsEnabled: false,
      isConfigured: true,
      getLocalDeveloperNotifications: localDiscovery,
    };
    serviceMap.localStorage = createStorage();

    renderDrawer();

    expect(await screen.findByText("Transfer ready")).toBeTruthy();
    expect(localDiscovery).not.toHaveBeenCalled();
    expect(screen.queryByText("Local dev")).toBeNull();
  });

  it("shows local developer entries when Reown is missing and imports without touching Relay", async () => {
    const user = userEvent.setup();
    const storage = createStorage();
    const localNotification = createLocalNotification();
    const importedPackage = {
      cid: "bafy",
      chain: { id: "ownable-1" },
    };
    const relay = {
      importFromRelay: vi.fn(),
      sendOwnable: vi.fn(),
    };

    serviceMap.notifications = createNotificationsService({
      isConfigured: false,
      configurationError: () =>
        "VITE_REOWN_PROJECT_ID or VITE_WALLETCONNECT_PROJECT_ID must be configured for notifications",
    });
    serviceMap.hub = {
      localDeveloperNotificationsEnabled: true,
      isConfigured: true,
      getLocalDeveloperNotifications: vi.fn().mockResolvedValue({
        owner: ACCOUNT,
        entries: [localNotification],
      }),
      importFromNotificationUrl: vi
        .fn()
        .mockResolvedValue(new File(["zip"], "bafy.zip", { type: "application/zip" })),
    };
    serviceMap.packages = {
      importFromHub: vi.fn().mockResolvedValue(importedPackage),
    };
    serviceMap.localStorage = storage;
    serviceMap.relay = relay;

    renderDrawer();

    expect(
      await screen.findByText(
        "Web3Inbox is not configured for this environment. Local developer notifications are available below and do not prove Reown delivery."
      )
    ).toBeTruthy();
    expect(await screen.findByText("Ownable available on localhost")).toBeTruthy();
    expect(await screen.findByText("Local dev")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /Import ownable/i }));

    await waitFor(() =>
      expect(serviceMap.hub.importFromNotificationUrl).toHaveBeenCalledWith(
        CANONICAL_URL
      )
    );
    expect(serviceMap.packages.importFromHub).toHaveBeenCalled();
    expect(relay.importFromRelay).not.toHaveBeenCalled();
    expect(relay.sendOwnable).not.toHaveBeenCalled();
  });

  it("dedupes local developer entries by canonical type and URL and keeps the Web3Inbox row", async () => {
    const web3InboxNotification = createNotification({
      title: "Transfer ready",
      body: "Imported from Web3Inbox",
    });
    const duplicateLocalNotification = createLocalNotification({
      title: "Local duplicate",
      body: "This should be suppressed",
    });

    serviceMap.notifications = createNotificationsService({
      pageNotifications: vi.fn().mockImplementation(async (_account, onUpdate) => {
        const data = {
          notifications: [web3InboxNotification],
          hasMore: false,
          hasMoreUnread: false,
        };
        onUpdate(data);
        return {
          data,
          nextPage: vi.fn(),
          stopWatchingNotifications: vi.fn(),
        };
      }),
    });
    serviceMap.hub = {
      localDeveloperNotificationsEnabled: true,
      isConfigured: true,
      getLocalDeveloperNotifications: vi.fn().mockResolvedValue({
        owner: ACCOUNT,
        entries: [duplicateLocalNotification],
      }),
    };
    serviceMap.localStorage = createStorage();

    renderDrawer();

    expect(await screen.findByText("Transfer ready")).toBeTruthy();
    expect(screen.queryByText("Local duplicate")).toBeNull();
    expect(screen.queryByText("Local dev")).toBeNull();
  });

  it("migrates legacy imported Web3Inbox IDs into canonical imported history keys", async () => {
    const storage = createStorage({
      [`web3inbox:imported:${ACCOUNT}`]: ["notif-legacy"],
      [`notifications:imported:${ACCOUNT}`]: [],
    });
    const notification = createNotification({ id: "notif-legacy" });

    serviceMap.notifications = createNotificationsService({
      pageNotifications: vi.fn().mockImplementation(async (_account, onUpdate) => {
        const data = {
          notifications: [notification],
          hasMore: false,
          hasMoreUnread: false,
        };
        onUpdate(data);
        return {
          data,
          nextPage: vi.fn(),
          stopWatchingNotifications: vi.fn(),
        };
      }),
    });
    serviceMap.hub = {
      localDeveloperNotificationsEnabled: false,
      isConfigured: true,
      getLocalDeveloperNotifications: vi.fn(),
    };
    serviceMap.localStorage = storage;

    renderDrawer();

    expect(await screen.findByText("Transfer ready")).toBeTruthy();
    await waitFor(() =>
      expect(storage.set).toHaveBeenCalledWith(`notifications:imported:${ACCOUNT}`, [
        CANONICAL_KEY,
      ])
    );
    expect(screen.getByRole("button", { name: "Imported" })).toBeTruthy();
  });

  it("persists local developer read state across reloads", async () => {
    const user = userEvent.setup();
    const storage = createStorage();
    const localNotification = createLocalNotification();

    serviceMap.notifications = createNotificationsService({
      isConfigured: false,
      configurationError: () => null,
    });
    serviceMap.hub = {
      localDeveloperNotificationsEnabled: true,
      isConfigured: true,
      getLocalDeveloperNotifications: vi.fn().mockResolvedValue({
        owner: ACCOUNT,
        entries: [localNotification],
      }),
    };
    serviceMap.localStorage = storage;

    const view = renderDrawer();

    expect(await screen.findByText("Ownable available on localhost")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /Mark read/i }));

    await waitFor(() =>
      expect(storage.set).toHaveBeenCalledWith(`notifications:read:${ACCOUNT}`, [
        CANONICAL_KEY,
      ])
    );

    view.unmount();
    renderDrawer();

    expect(await screen.findByText("Read")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Mark read/i })).toBeNull();
  });

  it("rejects unsupported local developer notification types before import", async () => {
    const user = userEvent.setup();
    const notification = createLocalNotification({
      id: "localdev:unsupported",
      type: "marketing.v1.broadcast",
      title: "Marketing update",
    });

    serviceMap.notifications = createNotificationsService({
      isConfigured: false,
    });
    serviceMap.hub = {
      localDeveloperNotificationsEnabled: true,
      isConfigured: true,
      getLocalDeveloperNotifications: vi.fn().mockResolvedValue({
        owner: ACCOUNT,
        entries: [notification],
      }),
      importFromNotificationUrl: vi.fn(),
    };
    serviceMap.packages = {
      importFromHub: vi.fn(),
    };
    serviceMap.localStorage = createStorage();

    renderDrawer();

    const button = await screen.findByRole("button", {
      name: "Unsupported type",
    });

    expect((button as HTMLButtonElement).disabled).toBe(true);
    await user.click(button);
    expect(serviceMap.hub.importFromNotificationUrl).not.toHaveBeenCalled();
    expect(serviceMap.packages.importFromHub).not.toHaveBeenCalled();
  });

  it("rejects off-origin local developer notification URLs through the existing Hub import guard", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { default: HubService } = await import("@/services/Hub.service");
    const hubInstance = new HubService("https://hub.example");

    serviceMap.notifications = createNotificationsService({
      isConfigured: false,
    });
    serviceMap.hub = {
      localDeveloperNotificationsEnabled: true,
      isConfigured: true,
      getLocalDeveloperNotifications: vi.fn().mockResolvedValue({
        owner: ACCOUNT,
        entries: [
          createLocalNotification({
            url: "https://evil.example/ownables/bafy/download",
          }),
        ],
      }),
      importFromNotificationUrl: hubInstance.importFromNotificationUrl.bind(hubInstance),
    };
    serviceMap.packages = {
      importFromHub: vi.fn(),
    };
    serviceMap.localStorage = createStorage();

    renderDrawer();

    await user.click(await screen.findByRole("button", { name: /Import ownable/i }));

    await waitFor(() =>
      expect(enqueueSnackbar).toHaveBeenCalledWith(
        "Notification URL must use the configured Hub origin",
        { variant: "error" }
      )
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(serviceMap.packages.importFromHub).not.toHaveBeenCalled();
  });

  it.each([
    "not_configured",
    "not_subscribed",
  ])(
    "updates localhost transfer warning copy when Web3Inbox delivery is %s",
    async (status) => {
      const user = userEvent.setup();
      const execute = vi.fn().mockResolvedValue(undefined);

      serviceMap.hub = {
        isAvailable: vi.fn().mockResolvedValue(true),
        uploadOwnable: vi.fn().mockResolvedValue({
          cid: "bafy",
          ownerAccount: "eip155:84532:0xdef",
        }),
        downloadOwnable: vi.fn().mockResolvedValue(
          new File(["zip"], "bafy.zip", { type: "application/zip" })
        ),
        getDeliveryStatus: vi.fn().mockResolvedValue({
          cid: "bafy",
          owner: "eip155:84532:0xdef",
          status,
        }),
      };
      serviceMap.ownables = {
        anchoring: false,
        zip: vi.fn().mockResolvedValue({
          generateAsync: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
        }),
        submitAnchors: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
      };

      render(
        <TransferHarness
          chain={{ id: "ownable-1" }}
          pkg={{ uniqueMessageHash: undefined }}
          execute={execute}
        />
      );

      await user.click(screen.getByRole("button", { name: "Transfer" }));

      await waitFor(() =>
        expect(serviceMap.hub.getDeliveryStatus).toHaveBeenCalledWith(
          "bafy",
          "eip155:84532:0xdef"
        )
      );
      expect(enqueueSnackbar).toHaveBeenCalledWith(
        `Transfer succeeded, but Web3Inbox delivery is ${status.replaceAll("_", " ")}. If VITE_LOCAL_DEVELOPER_NOTIFICATIONS=true, use the Notifications drawer local dev discovery path on localhost.`,
        { variant: "warning" }
      );
    }
  );

  it("persists imported ownables through the durable ownable storage path", async () => {
    const user = userEvent.setup();
    const persistedOwnables: any[] = [];
    const importedPackage = {
      cid: "bafy",
      chain: { id: "ownable-1" },
    };

    serviceMap.ownables = {
      loadAll: vi.fn().mockImplementation(async () => [...persistedOwnables]),
      initWorker: vi.fn().mockResolvedValue(undefined),
      init: vi.fn().mockImplementation(async (chain, cid) => {
        persistedOwnables.splice(0, persistedOwnables.length, {
          chain,
          package: cid,
          created: new Date("2026-06-06T00:00:00.000Z"),
          keywords: [],
          uniqueMessageHash: undefined,
        });
      }),
    };
    serviceMap.packages = {
      info: vi.fn().mockReturnValue({ title: "Imported ownable" }),
    };
    serviceMap.relay = {
      removeOwnable: vi.fn().mockResolvedValue(undefined),
    };
    serviceMap.idb = {
      deleteAllDatabases: vi.fn().mockResolvedValue(undefined),
    };

    const firstRender = render(
      <OwnablesHarness importedPackage={importedPackage} />
    );

    await screen.findByText("loaded");
    expect(screen.getByTestId("ownable-count").textContent).toBe("0");

    await user.click(
      screen.getByRole("button", { name: "Import persisted ownable" })
    );

    await waitFor(() =>
      expect(serviceMap.ownables.init).toHaveBeenCalledWith(
        importedPackage.chain,
        importedPackage.cid
      )
    );
    await waitFor(() =>
      expect(screen.getByTestId("ownable-count").textContent).toBe("1")
    );

    firstRender.unmount();

    render(<OwnablesHarness importedPackage={importedPackage} />);

    await waitFor(() =>
      expect(screen.getByTestId("ownable-count").textContent).toBe("1")
    );
  });

  it("uses strict Hub routes for import, delivery status, and local developer discovery", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(new Blob(["zip"]), {
          status: 200,
          headers: { "content-type": "application/zip" },
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            cid: "bafy",
            owner: ACCOUNT,
            status: "delivered",
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            owner: ACCOUNT,
            entries: [createLocalNotification()],
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          }
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    const { default: HubService } = await import("@/services/Hub.service");
    const hub = new HubService("https://hub.example");

    await hub.importFromNotificationUrl(CANONICAL_URL);
    await hub.getDeliveryStatus("bafy", ACCOUNT);
    await hub.getLocalDeveloperNotifications(ACCOUNT);

    expect(fetchMock).toHaveBeenNthCalledWith(1, CANONICAL_URL);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `https://hub.example/notify/delivery-status?cid=bafy&owner=${encodeURIComponent(
        ACCOUNT
      )}`
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      `https://hub.example/notify/local/discovery?owner=${encodeURIComponent(ACCOUNT)}`
    );
  });

  it("surfaces a non-blocking Hub local discovery warning when the route is unavailable", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("missing", { status: 404, statusText: "Not Found" })
    );
    vi.stubGlobal("fetch", fetchMock);

    const { default: HubService } = await import("@/services/Hub.service");
    const hub = new HubService("https://hub.example");

    await expect(hub.getLocalDeveloperNotifications(ACCOUNT)).rejects.toThrow(
      LOCAL_DEVELOPER_DISCOVERY_UNAVAILABLE_MESSAGE
    );
  });
});
