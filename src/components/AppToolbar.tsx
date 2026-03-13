import React from "react";
import { Alert } from "@/components/ui/primitives";
import logo from "../assets/logo.svg";
import { Menu as MenuIcon, Mail as MailOutlinedIcon, TriangleAlert as WarningIcon } from "lucide-react";
import { Button } from "./ui/button";
import { cva } from "class-variance-authority";
import { cn } from "./ui/lib/cn";

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
          icon={<WarningIcon />}
          sx={{
            borderRadius: 0,
            py: 0.5,
            "& .MuiAlert-message": {
              fontSize: "0.875rem",
              display: "flex",
              alignItems: "center",
              gap: 1,
            },
          }}
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

            <Button
              aria-label="messages"
              variant="ghost"
              iconOnly
              className="relative text-white hover:bg-white/20"
              onClick={onNotificationClick}
            >
              <MailOutlinedIcon />
              {messagesCount > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white">
                  {messagesCount}
                </span>
              ) : null}
            </Button>

            <Button
              aria-label="menu"
              variant="ghost"
              iconOnly
              className="text-white hover:bg-white/20"
              onClick={onMenuClick}
            >
              <MenuIcon />
            </Button>
          </div>
        </div>
      </header>
    </>
  );
}
