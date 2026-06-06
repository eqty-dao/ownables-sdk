import { useCallback, useEffect, useMemo, useState } from "react";
import { enqueueSnackbar } from "notistack";
import { useAccount } from "wagmi";
import type { TypedPackage } from "@/interfaces/TypedPackage";
import type {
  Web3InboxNotification,
  Web3InboxNotificationPage,
} from "@/services/Web3Inbox.service";
import { useService } from "./useService";

const IMPORTED_KEY_PREFIX = "web3inbox:imported:";

const toImportedSet = (value: unknown): Set<string> => {
  if (!Array.isArray(value)) return new Set<string>();
  return new Set(value.filter((item): item is string => typeof item === "string"));
};

const markReadInPage = (
  page: Web3InboxNotificationPage,
  notificationId: string
): Web3InboxNotificationPage => ({
  ...page,
  notifications: page.notifications.map((notification) =>
    notification.id === notificationId
      ? {
          ...notification,
          isRead: true,
        }
      : notification
  ),
});

export interface NotificationsDrawerState {
  account: string | null;
  isConfigured: boolean;
  configurationError: string | null;
  isRegistered: boolean;
  isSubscribed: boolean;
  unreadCount: number;
  notifications: Web3InboxNotification[];
  importedIds: Set<string>;
  isLoading: boolean;
  isEnabling: boolean;
  isDisabling: boolean;
  loadingNotificationId: string | null;
  hasMore: boolean;
  enableNotifications: () => Promise<void>;
  disableNotifications: () => Promise<void>;
  markAsRead: (notification: Web3InboxNotification) => Promise<void>;
  importNotification: (notification: Web3InboxNotification) => Promise<void>;
  loadMore: () => Promise<void>;
}

const OWNABLES_NOTIFICATION_TYPE = "ownables.v1.available";

const isOwnablesNotification = (
  notification: Pick<Web3InboxNotification, "type">
) => notification.type === OWNABLES_NOTIFICATION_TYPE;

export function useNotificationsDrawer(
  onImported: (pkg: TypedPackage) => Promise<void>
): NotificationsDrawerState {
  const notifications = useService("notifications");
  const hub = useService("hub");
  const packages = useService("packages");
  const storage = useService("localStorage");
  const { address, isConnected } = useAccount();

  const [account, setAccount] = useState<string | null>(null);
  const [configurationError, setConfigurationError] = useState<string | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState<Web3InboxNotificationPage>({
    notifications: [],
    hasMore: false,
    hasMoreUnread: false,
  });
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isEnabling, setIsEnabling] = useState(false);
  const [isDisabling, setIsDisabling] = useState(false);
  const [loadingNotificationId, setLoadingNotificationId] = useState<string | null>(null);
  const [loadMore, setLoadMore] = useState<() => Promise<void>>(async () => {});

  const importedStorageKey = useMemo(
    () => (account ? `${IMPORTED_KEY_PREFIX}${account}` : null),
    [account]
  );

  useEffect(() => {
    if (!notifications || !address || !isConnected) {
      setAccount(null);
      setConfigurationError(notifications?.configurationError() ?? null);
      return;
    }

    try {
      setAccount(notifications.toAccount(address));
      setConfigurationError(notifications.configurationError());
    } catch (error) {
      setAccount(null);
      setConfigurationError(
        error instanceof Error ? error.message : "Notifications are unavailable"
      );
    }
  }, [address, isConnected, notifications]);

  useEffect(() => {
    if (!storage || !importedStorageKey) {
      setImportedIds(new Set());
      return;
    }

    setImportedIds(toImportedSet(storage.get(importedStorageKey)));
  }, [importedStorageKey, storage]);

  useEffect(() => {
    if (!notifications || !account) {
      setIsRegistered(false);
      setIsSubscribed(false);
      setUnreadCount(0);
      return;
    }

    let active = true;
    let stopWatching = () => {};

    (async () => {
      try {
        const registered = await notifications.getRegistrationStatus(account);
        if (!active) return;
        setIsRegistered(registered);

        stopWatching = await notifications.watchSubscription(account, (subscription) => {
          if (!active) return;
          setIsSubscribed(!!subscription);
          setUnreadCount(subscription?.unreadNotificationCount ?? 0);
        });
      } catch (error) {
        if (!active) return;
        setConfigurationError(
          error instanceof Error ? error.message : "Notifications are unavailable"
        );
      }
    })();

    return () => {
      active = false;
      stopWatching();
    };
  }, [account, notifications]);

  useEffect(() => {
    if (!notifications || !account || !isSubscribed) {
      setPage({
        notifications: [],
        hasMore: false,
        hasMoreUnread: false,
      });
      setLoadMore(() => async () => {});
      return;
    }

    let active = true;
    let stopWatchingNotifications = () => {};

    setIsLoading(true);

    (async () => {
      try {
        const handle = await notifications.pageNotifications(account, (nextPage) => {
          if (!active) return;
          setPage(nextPage);
          setIsLoading(false);
        });

        if (!active) {
          handle.stopWatchingNotifications();
          return;
        }

        stopWatchingNotifications = handle.stopWatchingNotifications;
        setPage(handle.data);
        setLoadMore(() => handle.nextPage);
        setIsLoading(false);
      } catch (error) {
        if (!active) return;
        setConfigurationError(
          error instanceof Error ? error.message : "Failed to load notifications"
        );
        setIsLoading(false);
      }
    })();

    return () => {
      active = false;
      stopWatchingNotifications();
    };
  }, [account, isSubscribed, notifications]);

  const persistImportedIds = useCallback(
    (next: Set<string>) => {
      if (storage && importedStorageKey) {
        storage.set(importedStorageKey, Array.from(next));
      }
    },
    [importedStorageKey, storage]
  );

  const enableNotifications = useCallback(async () => {
    if (!notifications || !account) {
      throw new Error("Connect a wallet to enable notifications");
    }

    setIsEnabling(true);
    try {
      await notifications.enable(account);
      setIsRegistered(true);
      enqueueSnackbar("Notifications enabled", { variant: "success" });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to enable notifications";
      enqueueSnackbar(message, { variant: "error" });
      throw error;
    } finally {
      setIsEnabling(false);
    }
  }, [account, notifications]);

  const disableNotifications = useCallback(async () => {
    if (!notifications || !account) {
      return;
    }

    setIsDisabling(true);
    try {
      await notifications.disable(account);
      enqueueSnackbar("Notifications disabled", { variant: "success" });
    } catch (error) {
      enqueueSnackbar(
        error instanceof Error ? error.message : "Failed to disable notifications",
        { variant: "error" }
      );
      throw error;
    } finally {
      setIsDisabling(false);
    }
  }, [account, notifications]);

  const markAsRead = useCallback(
    async (notification: Web3InboxNotification) => {
      if (!notifications || !account || notification.isRead) {
        return;
      }

      await notifications.markNotificationsAsRead([notification.id], account);
      notification.read?.();
      setPage((current) => markReadInPage(current, notification.id));
      setUnreadCount((current) => Math.max(0, current - 1));
    },
    [account, notifications]
  );

  const importNotification = useCallback(
    async (notification: Web3InboxNotification) => {
      if (!isOwnablesNotification(notification)) {
        throw new Error("Unsupported notification type");
      }

      if (!hub || !packages || !notification.url) {
        throw new Error("Notification is missing a Hub import URL");
      }

      setLoadingNotificationId(notification.id);
      try {
        const file = await hub.importFromNotificationUrl(notification.url);
        const pkg = await packages.importFromHub(file);
        await onImported(pkg);
        await markAsRead(notification);
        setImportedIds((current) => {
          const next = new Set(current).add(notification.id);
          persistImportedIds(next);
          return next;
        });
        enqueueSnackbar("Ownable imported from notification", {
          variant: "success",
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to import notification";
        enqueueSnackbar(message, { variant: "error" });
        throw error;
      } finally {
        setLoadingNotificationId(null);
      }
    },
    [hub, markAsRead, onImported, packages, persistImportedIds]
  );

  return {
    account,
    isConfigured: notifications?.isConfigured ?? false,
    configurationError,
    isRegistered,
    isSubscribed,
    unreadCount,
    notifications: page.notifications,
    importedIds,
    isLoading,
    isEnabling,
    isDisabling,
    loadingNotificationId,
    hasMore: page.hasMore,
    enableNotifications,
    disableNotifications,
    markAsRead,
    importNotification,
    loadMore,
  };
}
