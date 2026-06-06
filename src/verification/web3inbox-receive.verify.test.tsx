import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NotificationsDrawer from "@/components/NotificationsDrawer";
import { useOwnableTransfer } from "@/hooks/useOwnableTransfer";

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
}));

vi.mock("@/contexts/Progress.context", () => ({
  useProgress: () => ({
    open: vi.fn(() => [{ close: vi.fn() }, vi.fn()]),
  }),
}));

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

describe("web3inbox receive verifier", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(serviceMap).forEach((key) => delete serviceMap[key]);
    accountState.address = "0xabc";
    accountState.isConnected = true;
  });

  it("lists notifications, tracks unread state, and keeps imported items visible", async () => {
    const user = userEvent.setup();
    const setStorage = vi.fn();
    const markNotificationsAsRead = vi.fn();
    const notification = {
      id: "notif-1",
      title: "Transfer ready",
      body: "Import your Ownable from Hub",
      sentAt: Date.now(),
      url: "https://hub.example/ownables/bafy/download",
      isRead: false,
      type: "ownables.v1.available",
      read: vi.fn(),
    };

    serviceMap.notifications = {
      isConfigured: true,
      configurationError: () => null,
      toAccount: () => "eip155:84532:0xabc",
      getRegistrationStatus: vi.fn().mockResolvedValue(true),
      watchSubscription: vi.fn().mockImplementation(async (_account, cb) => {
        cb({ unreadNotificationCount: 2 });
        return () => {};
      }),
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
      markNotificationsAsRead,
      enable: vi.fn(),
      disable: vi.fn(),
    };
    serviceMap.hub = {
      importFromNotificationUrl: vi
        .fn()
        .mockResolvedValue(new File(["zip"], "bafy.zip", { type: "application/zip" })),
    };
    const importedPackage = {
      cid: "bafy",
      chain: { id: "ownable-1" },
    };
    serviceMap.packages = {
      importFromHub: vi.fn().mockResolvedValue(importedPackage),
    };
    serviceMap.localStorage = {
      get: vi.fn().mockReturnValue([]),
      set: setStorage,
    };

    const onImported = vi.fn();
    const onUnreadCountChange = vi.fn();

    render(
      <NotificationsDrawer
        open={true}
        onClose={() => {}}
        onImported={onImported}
        onUnreadCountChange={onUnreadCountChange}
      />
    );

    expect(await screen.findByText("Transfer ready")).toBeTruthy();
    await waitFor(() => expect(onUnreadCountChange).toHaveBeenLastCalledWith(2));
    expect(screen.queryByText("Not subscribed")).toBeNull();

    await user.click(screen.getByRole("button", { name: /Mark read/i }));

    await waitFor(() =>
      expect(markNotificationsAsRead).toHaveBeenCalledWith(
        ["notif-1"],
        "eip155:84532:0xabc"
      )
    );

    await user.click(screen.getByRole("button", { name: /Import ownable/i }));

    await waitFor(() =>
      expect(serviceMap.hub.importFromNotificationUrl).toHaveBeenCalledWith(
        "https://hub.example/ownables/bafy/download"
      )
    );
    expect(serviceMap.packages.importFromHub).toHaveBeenCalled();
    expect(onImported).toHaveBeenCalledWith(importedPackage);
    expect(setStorage).toHaveBeenCalledWith(
      "web3inbox:imported:eip155:84532:0xabc",
      ["notif-1"]
    );
    expect(
      (screen.getByRole("button", { name: "Imported" }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
    expect(screen.getByText("Transfer ready")).toBeTruthy();
  });

  it("warns when transfer succeeds but delivery status is not delivered", async () => {
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
        status: "pending",
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
      "Transfer succeeded, but notification delivery is pending.",
      { variant: "warning" }
    );
  });

  it("uses strict Hub origin for imports and delivery-status lookups", async () => {
    vi.resetModules();
    Object.assign(import.meta.env, {
      VITE_HUB: "https://hub.example",
    });

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
            owner: "eip155:84532:0xabc",
            status: "delivered",
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

    await hub.importFromNotificationUrl("https://hub.example/ownables/bafy/download");
    await hub.getDeliveryStatus("bafy", "eip155:84532:0xabc");

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://hub.example/ownables/bafy/download"
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://hub.example/notify/delivery-status?cid=bafy&owner=eip155%3A84532%3A0xabc"
    );

    await expect(
      hub.importFromNotificationUrl("https://evil.example/ownables/bafy/download")
    ).rejects.toThrow("Notification URL must use the configured Hub origin");
  });

  it("enables notifications through Web3Inbox registration and subscription", async () => {
    vi.resetModules();
    Object.assign(import.meta.env, {
      VITE_REOWN_PROJECT_ID: "reown-project",
      VITE_REOWN_APP_DOMAIN: "hub.ownables.example",
      VITE_WALLETCONNECT_PROJECT_ID: "",
    });

    const client = {
      setAccount: vi.fn().mockResolvedValue(undefined),
      prepareRegistration: vi.fn().mockReturnValue({
        message: "Authorize notifications",
        registerParams: { domain: "hub.ownables.example" },
      }),
      register: vi.fn().mockResolvedValue("identity-key"),
      subscribeToDapp: vi.fn().mockResolvedValue(undefined),
    };

    vi.doMock("@web3inbox/core", () => ({
      Web3InboxClient: {
        init: vi.fn().mockResolvedValue(client),
      },
    }));

    const { default: Web3InboxService } = await import(
      "@/services/Web3Inbox.service"
    );

    const walletClient = {
      account: "0xabc",
      signMessage: vi.fn().mockResolvedValue("0xsigned"),
    };
    const service = new Web3InboxService(walletClient as any, 84532);

    await service.enable("eip155:84532:0xabc");

    expect(client.setAccount).toHaveBeenCalledWith("eip155:84532:0xabc");
    expect(client.prepareRegistration).toHaveBeenCalledWith({
      account: "eip155:84532:0xabc",
    });
    expect(walletClient.signMessage).toHaveBeenCalledWith({
      account: "0xabc",
      message: "Authorize notifications",
    });
    expect(client.register).toHaveBeenCalledWith({
      registerParams: { domain: "hub.ownables.example" },
      signature: "0xsigned",
    });
    expect(client.subscribeToDapp).toHaveBeenCalledWith("eip155:84532:0xabc");
  });
});
