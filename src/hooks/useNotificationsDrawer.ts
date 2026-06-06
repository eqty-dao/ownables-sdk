import { useCallback, useEffect, useMemo, useState } from "react";
import { enqueueSnackbar } from "notistack";
import { useAccount } from "wagmi";
import type { TypedPackage } from "@/interfaces/TypedPackage";
import type {
  HubLocalDeveloperNotificationEntry,
} from "@/services/Hub.service";
import {
  LOCAL_DEVELOPER_DISCOVERY_UNAVAILABLE_MESSAGE,
} from "@/services/Hub.service";
import type {
  Web3InboxNotification,
  Web3InboxNotificationPage,
} from "@/services/Web3Inbox.service";
import { useService } from "./useService";

const LEGACY_IMPORTED_KEY_PREFIX = "web3inbox:imported:";
const IMPORTED_KEY_PREFIX = "notifications:imported:";
const LOCAL_READ_KEY_PREFIX = "notifications:read:";
const OWNABLES_NOTIFICATION_TYPE = "ownables.v1.available";
const LOCAL_DEVELOPER_NOTIFICATIONS_MISSING_HUB_MESSAGE =
  "VITE_HUB must be configured when VITE_LOCAL_DEVELOPER_NOTIFICATIONS=true";
const LOCAL_DEVELOPER_NOTIFICATIONS_WARNING =
  "Web3Inbox is not configured for this environment. Local developer notifications are available below and do not prove Reown delivery.";

export interface DrawerNotification {
  id: string;
  canonicalKey: string;
  source: "web3inbox" | "local-dev";
  scope?: "local-dev";
  title: string;
  body: string;
  sentAt: string | number;
  url?: string | null;
  type: string;
  isRead: boolean;
  read?: () => void;
}

export interface NotificationsDrawerState {
  account: string | null;
  isConfigured: boolean;
  configurationError: string | null;
  localDeveloperDiscoveryError: string | null;
  isLocalDeveloperNotificationsEnabled: boolean;
  isRegistered: boolean;
  isSubscribed: boolean;
  unreadCount: number;
  notifications: DrawerNotification[];
  importedKeys: Set<string>;
  isLoading: boolean;
  isEnabling: boolean;
  isDisabling: boolean;
  loadingNotificationId: string | null;
  hasMore: boolean;
  enableNotifications: () => Promise<void>;
  disableNotifications: () => Promise<void>;
  markAsRead: (notification: DrawerNotification) => Promise<void>;
  importNotification: (notification: DrawerNotification) => Promise<void>;
  loadMore: () => Promise<void>;
}

const toStoredSet = (value: unknown): Set<string> => {
  if (!Array.isArray(value)) return new Set<string>();
  return new Set(value.filter((item): item is string => typeof item === "string"));
};

const normalizeNotificationUrl = (url?: string | null): string => {
  if (!url) return "";

  try {
    return new URL(url).toString();
  } catch {
    return url.trim();
  }
};

const toCanonicalKey = (notification: Pick<DrawerNotification, "type" | "url">) =>
  `${notification.type}|${normalizeNotificationUrl(notification.url)}`;

const isOwnablesNotification = (
  notification: Pick<DrawerNotification, "type">
) => notification.type === OWNABLES_NOTIFICATION_TYPE;

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

const sortBySentAtDescending = (a: DrawerNotification, b: DrawerNotification) =>
  new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime();

const toDrawerNotification = (
  notification: Web3InboxNotification
): DrawerNotification => ({
  id: notification.id,
  canonicalKey: toCanonicalKey(notification),
  source: "web3inbox",
  title: notification.title,
  body: notification.body,
  sentAt: notification.sentAt,
  url: notification.url,
  type: notification.type,
  isRead: notification.isRead,
  read: notification.read,
});

const toLocalDeveloperDrawerNotification = (
  notification: HubLocalDeveloperNotificationEntry,
  localReadKeys: Set<string>
): DrawerNotification => {
  const canonicalKey = toCanonicalKey(notification);

  return {
    id: notification.id,
    canonicalKey,
    source: "local-dev",
    scope: notification.scope,
    title: notification.title,
    body: notification.body,
    sentAt: notification.sentAt,
    url: notification.url,
    type: notification.type,
    isRead: localReadKeys.has(canonicalKey),
  };
};

const mergeNotifications = (
  web3InboxNotifications: Web3InboxNotification[],
  localDeveloperNotifications: HubLocalDeveloperNotificationEntry[],
  localReadKeys: Set<string>
): DrawerNotification[] => {
  const merged = new Map<string, DrawerNotification>();

  for (const notification of web3InboxNotifications) {
    const row = toDrawerNotification(notification);
    merged.set(row.canonicalKey, row);
  }

  for (const notification of localDeveloperNotifications) {
    const row = toLocalDeveloperDrawerNotification(notification, localReadKeys);
    if (!merged.has(row.canonicalKey)) {
      merged.set(row.canonicalKey, row);
    }
  }

  return Array.from(merged.values()).sort(sortBySentAtDescending);
};

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
  const [localDeveloperDiscoveryError, setLocalDeveloperDiscoveryError] = useState<
    string | null
  >(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState<Web3InboxNotificationPage>({
    notifications: [],
    hasMore: false,
    hasMoreUnread: false,
  });
  const [localDeveloperNotifications, setLocalDeveloperNotifications] = useState<
    HubLocalDeveloperNotificationEntry[]
  >([]);
  const [importedKeys, setImportedKeys] = useState<Set<string>>(new Set());
  const [localReadKeys, setLocalReadKeys] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isEnabling, setIsEnabling] = useState(false);
  const [isDisabling, setIsDisabling] = useState(false);
  const [loadingNotificationId, setLoadingNotificationId] = useState<string | null>(null);
  const [loadMore, setLoadMore] = useState<() => Promise<void>>(async () => {});

  const importedStorageKey = useMemo(
    () => (account ? `${IMPORTED_KEY_PREFIX}${account}` : null),
    [account]
  );
  const legacyImportedStorageKey = useMemo(
    () => (account ? `${LEGACY_IMPORTED_KEY_PREFIX}${account}` : null),
    [account]
  );
  const localReadStorageKey = useMemo(
    () => (account ? `${LOCAL_READ_KEY_PREFIX}${account}` : null),
    [account]
  );

  const isLocalDeveloperNotificationsEnabled =
    hub?.localDeveloperNotificationsEnabled ?? false;

  const mergedNotifications = useMemo(
    () =>
      mergeNotifications(
        page.notifications,
        localDeveloperNotifications,
        localReadKeys
      ),
    [localDeveloperNotifications, localReadKeys, page.notifications]
  );

  useEffect(() => {
    if (!notifications || !address || !isConnected) {
      setAccount(null);
      setConfigurationError(notifications?.configurationError() ?? null);
      return;
    }

    try {
      setAccount(notifications.toAccount(address));
      const nextError = notifications.configurationError();
      if (nextError && isLocalDeveloperNotificationsEnabled) {
        setConfigurationError(LOCAL_DEVELOPER_NOTIFICATIONS_WARNING);
      } else {
        setConfigurationError(nextError);
      }
    } catch (error) {
      setAccount(null);
      setConfigurationError(
        error instanceof Error ? error.message : "Notifications are unavailable"
      );
    }
  }, [address, isConnected, isLocalDeveloperNotificationsEnabled, notifications]);

  useEffect(() => {
    if (!storage || !importedStorageKey) {
      setImportedKeys(new Set());
      return;
    }

    setImportedKeys(toStoredSet(storage.get(importedStorageKey)));
  }, [importedStorageKey, storage]);

  useEffect(() => {
    if (!storage || !localReadStorageKey) {
      setLocalReadKeys(new Set());
      return;
    }

    setLocalReadKeys(toStoredSet(storage.get(localReadStorageKey)));
  }, [localReadStorageKey, storage]);

  useEffect(() => {
    if (!storage || !importedStorageKey || !legacyImportedStorageKey) {
      return;
    }

    const legacyImportedIds = toStoredSet(storage.get(legacyImportedStorageKey));
    if (legacyImportedIds.size === 0) {
      return;
    }

    const migratedKeys = new Set(importedKeys);

    for (const notification of page.notifications) {
      if (legacyImportedIds.has(notification.id)) {
        migratedKeys.add(toCanonicalKey(notification));
      }
    }

    if (migratedKeys.size === importedKeys.size) {
      return;
    }

    storage.set(importedStorageKey, Array.from(migratedKeys));
    setImportedKeys(migratedKeys);
  }, [
    importedKeys,
    importedStorageKey,
    legacyImportedStorageKey,
    page.notifications,
    storage,
  ]);

  useEffect(() => {
    if (!notifications || !account || !notifications.isConfigured) {
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
    if (!notifications || !account || !isSubscribed || !notifications.isConfigured) {
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

  useEffect(() => {
    if (!hub || !account || !isLocalDeveloperNotificationsEnabled) {
      setLocalDeveloperNotifications([]);
      setLocalDeveloperDiscoveryError(null);
      return;
    }

    if (!hub.isConfigured) {
      setLocalDeveloperNotifications([]);
      setLocalDeveloperDiscoveryError(
        LOCAL_DEVELOPER_NOTIFICATIONS_MISSING_HUB_MESSAGE
      );
      return;
    }

    let active = true;

    (async () => {
      try {
        const discovery = await hub.getLocalDeveloperNotifications(account);
        if (!active) return;
        setLocalDeveloperNotifications(discovery.entries);
        setLocalDeveloperDiscoveryError(null);
      } catch (error) {
        if (!active) return;
        setLocalDeveloperNotifications([]);
        setLocalDeveloperDiscoveryError(
          error instanceof Error
            ? error.message
            : LOCAL_DEVELOPER_DISCOVERY_UNAVAILABLE_MESSAGE
        );
      }
    })();

    return () => {
      active = false;
    };
  }, [account, hub, isLocalDeveloperNotificationsEnabled]);

  const persistImportedKeys = useCallback(
    (next: Set<string>) => {
      if (storage && importedStorageKey) {
        storage.set(importedStorageKey, Array.from(next));
      }
    },
    [importedStorageKey, storage]
  );

  const persistLocalReadKeys = useCallback(
    (next: Set<string>) => {
      if (storage && localReadStorageKey) {
        storage.set(localReadStorageKey, Array.from(next));
      }
    },
    [localReadStorageKey, storage]
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
    async (notification: DrawerNotification) => {
      if (notification.source === "web3inbox") {
        if (!notifications || !account || notification.isRead) {
          return;
        }

        await notifications.markNotificationsAsRead([notification.id], account);
        notification.read?.();
        setPage((current) => markReadInPage(current, notification.id));
        setUnreadCount((current) => Math.max(0, current - 1));
        return;
      }

      if (notification.isRead) {
        return;
      }

      setLocalReadKeys((current) => {
        const next = new Set(current).add(notification.canonicalKey);
        persistLocalReadKeys(next);
        return next;
      });
    },
    [account, notifications, persistLocalReadKeys]
  );

  const importNotification = useCallback(
    async (notification: DrawerNotification) => {
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
        setImportedKeys((current) => {
          const next = new Set(current).add(notification.canonicalKey);
          persistImportedKeys(next);
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
    [hub, markAsRead, onImported, packages, persistImportedKeys]
  );

  return {
    account,
    isConfigured: notifications?.isConfigured ?? false,
    configurationError,
    localDeveloperDiscoveryError,
    isLocalDeveloperNotificationsEnabled,
    isRegistered,
    isSubscribed,
    unreadCount,
    notifications: mergedNotifications,
    importedKeys,
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
