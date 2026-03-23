import { Alert } from "@/components/ui";
import logo from "@/assets/logo.svg";
import { Menu as MenuIcon, TriangleAlert as WarningIcon, Bell } from "lucide-react";
import { IconButton } from "@/components/ui";
import { cva } from "class-variance-authority";
import { cn } from "@/utils/cn";

interface AppToolbarProps {
  onMenuClick: () => void;
  onNotificationClick: () => void;
  messagesCount: number;
  chainId?: number;
  isConnected: boolean;
}

const BASE_SEPOLIA_CHAIN_ID = 84532; // Base Sepolia

const networkPill = cva(
  "rounded-lg px-3 py-1.5 text-xs font-semibold text-white",
  {
    variants: {
      state: {
        ok: "bg-green-600",
        bad: "bg-red-600",
      },
    },
    defaultVariants: {
      state: "ok",
    },
  }
);

const warningStrip = cva(
  "flex items-center gap-2 rounded-none border-b px-4 py-2 text-sm",
  {
    variants: {
      tone: {
        warning: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/50 dark:text-amber-200",
      },
    },
    defaultVariants: {
      tone: "warning",
    },
  }
);

const toolbarIconButton = cva("relative text-white hover:bg-white/20");
const notificationBadge = cva(
  "absolute -right-0.5 -top-0.5 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white"
);

export default function AppToolbar({
  onMenuClick,
  onNotificationClick,
  messagesCount,
  chainId,
  isConnected,
}: AppToolbarProps) {
  const isOnBaseSepolia = chainId === BASE_SEPOLIA_CHAIN_ID;
  const showNetworkWarning = isConnected && !isOnBaseSepolia;

  return (
    <>
      {showNetworkWarning && (
        <Alert
          severity="warning"
          icon={<WarningIcon className="h-4 w-4" />}
          className={cn(warningStrip())}
        >
          Please switch to <strong>Base Sepolia</strong> network to use this application.
        </Alert>
      )}
      <header className="relative z-10 bg-gradient-to-r from-sky-500 to-indigo-600 px-4 py-3 shadow-lg sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <img
            src={logo}
            className="h-8 w-auto max-w-[min(55vw,300px)]"
            alt="Ownables Logo"
          />
          <div className="flex items-center gap-2">
            {isConnected && (
              <span className={cn(networkPill({ state: isOnBaseSepolia ? "ok" : "bad" }))}>
                {isOnBaseSepolia ? "Base Sepolia" : "Wrong Network"}
              </span>
            )}

            <IconButton
              aria-label="messages"
              className={cn(toolbarIconButton())}
              onClick={onNotificationClick}
            >
              <Bell />
              {messagesCount > 0 ? (
                <span className={cn(notificationBadge())}>
                  {messagesCount}
                </span>
              ) : null}
            </IconButton>

            <IconButton
              aria-label="menu"
              className={cn(toolbarIconButton())}
              onClick={onMenuClick}
            >
              <MenuIcon />
            </IconButton>
          </div>
        </div>
      </header>
    </>
  );
}
