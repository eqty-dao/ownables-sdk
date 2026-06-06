import { cva } from "class-variance-authority";
import { Bell, CheckCheck, Download, LoaderCircle } from "lucide-react";
import { useEffect } from "react";
import { useNotificationsDrawer } from "@/hooks/useNotificationsDrawer";
import type { TypedPackage } from "@/interfaces/TypedPackage";
import {
  Alert,
  Box,
  Button,
  Drawer,
  DrawerHeader,
  List,
  ListItem,
  Skeleton,
} from "@/components/ui";
import { cn } from "@/utils/cn";

interface NotificationsDrawerProps {
  open: boolean;
  onClose: () => void;
  onImported: (pkg: TypedPackage) => Promise<void>;
  onUnreadCountChange?: (count: number) => void;
}

const notificationItem = cva(
  "mb-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-xs dark:border-slate-800 dark:bg-slate-950"
);

const statePill = cva(
  "inline-flex items-center rounded-full px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.08em]",
  {
    variants: {
      tone: {
        neutral:
          "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
        success:
          "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200",
        warning:
          "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  }
);

export default function NotificationsDrawer({
  open,
  onClose,
  onImported,
  onUnreadCountChange,
}: NotificationsDrawerProps) {
  const {
    account,
    isConfigured,
    configurationError,
    localDeveloperDiscoveryError,
    isLocalDeveloperNotificationsEnabled,
    isRegistered,
    isSubscribed,
    unreadCount,
    notifications,
    importedKeys,
    isLoading,
    isEnabling,
    isDisabling,
    loadingNotificationId,
    hasMore,
    enableNotifications,
    disableNotifications,
    markAsRead,
    importNotification,
    loadMore,
  } = useNotificationsDrawer(onImported);

  useEffect(() => {
    onUnreadCountChange?.(unreadCount);
  }, [onUnreadCountChange, unreadCount]);

  return (
    <Drawer anchor="right" open={open} onClose={onClose} className="w-96 max-w-full">
      <DrawerHeader title="Notifications" closeAriaLabel="Close notifications" />
      <Box className="px-6 pb-6">
        <Box className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
          <Box className="flex items-start justify-between gap-3">
            <Box>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                Web3Inbox
              </p>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                Enable notifications explicitly, sign once, then import from the
                Hub-backed download URL.
              </p>
            </Box>
            <Bell className="h-5 w-5 text-slate-500 dark:text-slate-300" />
          </Box>

          <Box className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className={cn(statePill({ tone: isSubscribed ? "success" : "warning" }))}>
              {isSubscribed ? `${unreadCount} unread` : "Not subscribed"}
            </span>
            {isRegistered ? (
              <span className={cn(statePill({ tone: "neutral" }))}>Registered</span>
            ) : null}
            {isLocalDeveloperNotificationsEnabled ? (
              <span className={cn(statePill({ tone: "neutral" }))}>
                Local dev discovery enabled
              </span>
            ) : null}
            {account ? (
              <span className="truncate text-[0.7rem] text-slate-500 dark:text-slate-400">
                {account}
              </span>
            ) : null}
          </Box>

          {!account ? (
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              Connect a wallet to manage notifications.
            </p>
          ) : null}

          {configurationError ? (
            <Alert severity="warning" className="mt-3">
              {configurationError}
            </Alert>
          ) : null}

          {localDeveloperDiscoveryError ? (
            <Alert severity="warning" className="mt-3">
              {localDeveloperDiscoveryError}
            </Alert>
          ) : null}

          {account && isConfigured ? (
            <Box className="mt-4 flex gap-2">
              {!isSubscribed ? (
                <Button
                  onClick={() => {
                    void enableNotifications().catch(() => {});
                  }}
                  disabled={isEnabling}
                  className="flex-1"
                >
                  {isEnabling ? "Signing..." : "Enable notifications"}
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    void disableNotifications().catch(() => {});
                  }}
                  disabled={isDisabling}
                  className="flex-1"
                  variant="ghost"
                >
                  {isDisabling ? "Disabling..." : "Disable notifications"}
                </Button>
              )}
            </Box>
          ) : null}
        </Box>

        <Box className="mt-5 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Notification history
          </h3>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Read and imported items stay visible
          </span>
        </Box>

        {isLoading ? (
          <List className="mt-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <ListItem key={index} className={cn(notificationItem())}>
                <Skeleton height={18} width="55%" />
                <Skeleton height={14} width="100%" className="mt-2" />
                <Skeleton height={14} width="75%" className="mt-2" />
              </ListItem>
            ))}
          </List>
        ) : notifications.length === 0 ? (
          <Box className="mt-3 rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            {isSubscribed
              ? "No notifications yet."
              : isLocalDeveloperNotificationsEnabled
                ? "Enable Web3Inbox notifications or use local developer notifications when they are available."
                : "Enable notifications to start receiving Ownable deliveries."}
          </Box>
        ) : (
          <List className="mt-3">
            {notifications.map((notification) => {
              const isImported = importedKeys.has(notification.canonicalKey);
              const isBusy = loadingNotificationId === notification.id;
              const isSupportedType =
                notification.type === "ownables.v1.available";

              return (
                <ListItem key={notification.id} className={cn(notificationItem())}>
                  <Box className="flex items-start justify-between gap-3">
                    <Box className="min-w-0 flex-1">
                      <Box className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          {notification.title}
                        </p>
                        <span
                          className={cn(
                            statePill({
                              tone: notification.isRead ? "neutral" : "warning",
                            })
                          )}
                        >
                          {notification.isRead ? "Read" : "Unread"}
                        </span>
                        {notification.source === "local-dev" ? (
                          <span className={cn(statePill({ tone: "warning" }))}>
                            Local dev
                          </span>
                        ) : null}
                        {isImported ? (
                          <span className={cn(statePill({ tone: "success" }))}>
                            Imported
                          </span>
                        ) : null}
                      </Box>
                      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                        {notification.body}
                      </p>
                      {notification.source === "local-dev" ? (
                        <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                          Local developer discovery is SDK-only and does not prove Reown delivery.
                        </p>
                      ) : null}
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        {new Date(notification.sentAt).toLocaleString()}
                      </p>
                    </Box>
                  </Box>

                  <Box className="mt-3 flex flex-wrap gap-2">
                    {!notification.isRead ? (
                      <Button
                        size="small"
                        variant="ghost"
                        onClick={() => {
                          void markAsRead(notification).catch(() => {});
                        }}
                      >
                        <CheckCheck className="mr-1 h-4 w-4" />
                        Mark read
                      </Button>
                    ) : null}
                    <Button
                      size="small"
                      onClick={() => {
                        void importNotification(notification).catch(() => {});
                      }}
                      disabled={isImported || isBusy || !isSupportedType}
                    >
                      {isBusy ? (
                        <LoaderCircle className="mr-1 h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="mr-1 h-4 w-4" />
                      )}
                      {isImported
                        ? "Imported"
                        : isSupportedType
                          ? "Import ownable"
                          : "Unsupported type"}
                    </Button>
                  </Box>
                </ListItem>
              );
            })}
          </List>
        )}

        {hasMore ? (
          <Button
            variant="ghost"
            className="mt-4 w-full"
            onClick={() => {
              void loadMore().catch(() => {});
            }}
          >
            Load more
          </Button>
        ) : null}
      </Box>
    </Drawer>
  );
}
