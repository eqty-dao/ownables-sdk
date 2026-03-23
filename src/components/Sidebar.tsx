import {
  Box,
  Switch,
  Button,
} from "@/components/ui";
import { useEffect, useState } from "react";
import { X as CloseIcon, Sun, Moon, Monitor, Copy } from "lucide-react";
import { Drawer, DrawerClose } from "@/components/ui";
import EventChainService from "../services/EventChain.service";
import WalletConnectControls from "./WalletConnectControls";
import { useAccount, useBalance, useDisconnect } from "wagmi"
import { useChainModal } from "@rainbow-me/rainbowkit"
import useEqtyToken from "../hooks/useEqtyToken"
import { cva } from "class-variance-authority";
import { cn } from "@/utils/cn";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  onReset: () => void;
  onFactoryReset: () => void;
}

type ThemeMode = "light" | "dark" | "system";

const modeButton = cva(
  "w-full rounded-xl border-2 p-3 text-sm font-medium transition-colors",
  {
    variants: {
      active: {
        true: "border-indigo-600 bg-indigo-50 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-950/20 dark:text-indigo-300",
        false: "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-[#333333] dark:bg-transparent dark:text-slate-300 dark:hover:bg-[#252525]",
      },
    },
    defaultVariants: {
      active: false,
    },
  }
);

function resolveSystemDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyThemeMode(mode: ThemeMode) {
  const root = document.documentElement;
  const useDark = mode === "dark" || (mode === "system" && resolveSystemDark());
  root.classList.toggle("dark", useDark);
  root.dataset.themeMode = mode;
}

export default function Sidebar(props: SidebarProps) {
  const { open, onClose, onReset, onFactoryReset } = props;
  const [anchoring, setAnchoring] = useState(EventChainService.anchoring);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const stored = localStorage.getItem("theme-mode");
    return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
  });
  const { address, isConnected, chain } = useAccount();
  const { disconnect } = useDisconnect();
  const { openChainModal } = useChainModal();
  const { data: ethBalance } = useBalance({ address, query: { refetchInterval: open ? 10000 : false } });
  const { balance: eqtyBalance } = useEqtyToken({ address });

  useEffect(() => {
    EventChainService.anchoring = anchoring;
  }, [anchoring]);

  useEffect(() => {
    applyThemeMode(themeMode);
    localStorage.setItem("theme-mode", themeMode);

    if (themeMode !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => applyThemeMode("system");
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [themeMode]);

  const shortAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : "";

  const copyAddress = () => {
    if (address) navigator.clipboard.writeText(address);
  };

  const handleNetworkClick = () => {
    openChainModal?.();
  };

  return (
    <>
      <Drawer anchor="right" open={open} onClose={onClose} className="flex w-[384px] flex-col overflow-hidden">
        {/* Header */}
        <Box className="flex flex-shrink-0 items-center justify-between p-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Settings</h2>
          <DrawerClose
            aria-label="Close settings"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-transparent p-0 text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-[#2a2a2a]"
          >
            <CloseIcon className="h-5 w-5" />
          </DrawerClose>
        </Box>

        {/* Scrollable content */}
        <Box className="flex flex-1 flex-col overflow-y-auto p-6">

          {/* Network badge — clickable to switch chain */}
          {isConnected && chain && (
            <div className="mb-8">
              <button
                type="button"
                onClick={handleNetworkClick}
                className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 transition-colors hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/30 dark:hover:bg-indigo-950/50"
                title="Click to switch network"
              >
                <span className="h-2 w-2 rounded-full bg-indigo-600 dark:bg-indigo-400" />
                <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
                  {chain.name?.toUpperCase() ?? "NETWORK"}
                </span>
              </button>
            </div>
          )}

          {/* Wallet info rows (connected) */}
          {isConnected && (
            <Box className="mb-8 flex flex-col gap-4">
              {/* Address row */}
              <Box>
                <p className="mb-1 text-xs text-slate-500 dark:text-slate-400">Address</p>
                <div className="flex items-center gap-2">
                  <p className="font-mono text-sm text-slate-900 dark:text-slate-100">{shortAddress}</p>
                  <Button
                    variant="ghost"
                    onClick={copyAddress}
                    aria-label="Copy address"
                    className="h-7 w-7 p-0"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </Box>

              {/* ETH Balance */}
              <Box>
                <p className="mb-1 text-xs text-slate-500 dark:text-slate-400">ETH Balance</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {ethBalance ? `${Number(ethBalance.formatted).toFixed(4)} ETH` : "— ETH"}
                </p>
              </Box>

              {/* EQTY Balance */}
              <Box>
                <p className="mb-1 text-xs text-slate-500 dark:text-slate-400">EQTY Balance</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {eqtyBalance !== undefined
                    ? `${Number(eqtyBalance.formatted).toFixed(2)} EQTY`
                    : "— EQTY"}
                </p>
              </Box>
            </Box>
          )}

          {/* DISCONNECT button (connected) */}
          {isConnected && (
            <Button
              variant="primary"
              size="large"
              className="mb-8 w-full"
              onClick={() => disconnect()}
            >
              DISCONNECT
            </Button>
          )}

          {/* WalletConnectControls (not connected) */}
          {!isConnected && (
            <Box className="mb-8">
              <WalletConnectControls />
            </Box>
          )}

          {/* Anchor events card */}
          {isConnected && (
            <Box className="mb-8 flex items-center justify-between rounded-xl border border-black/10 p-4 dark:border-[#333333]">
              <Box>
                <p className="text-base font-medium text-slate-900 dark:text-slate-100">Anchor events</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Enable event anchoring</p>
              </Box>
              <Switch checked={anchoring} onChange={(e) => setAnchoring(e.target.checked)} aria-label="Anchor events" />
            </Box>
          )}

          {/* Theme buttons */}
          <Box className="grid grid-cols-3 gap-2">
            <button
              type="button"
              className={cn(modeButton({ active: themeMode === "light" }))}
              onClick={() => setThemeMode("light")}
            >
              <span className="flex flex-col items-center gap-1">
                <Sun className="h-6 w-6" />
                <span>Light</span>
              </span>
            </button>
            <button
              type="button"
              className={cn(modeButton({ active: themeMode === "dark" }))}
              onClick={() => setThemeMode("dark")}
            >
              <span className="flex flex-col items-center gap-1">
                <Moon className="h-6 w-6" />
                <span>Dark</span>
              </span>
            </button>
            <button
              type="button"
              className={cn(modeButton({ active: themeMode === "system" }))}
              onClick={() => setThemeMode("system")}
            >
              <span className="flex flex-col items-center gap-1">
                <Monitor className="h-6 w-6" />
                <span>System</span>
              </span>
            </button>
          </Box>
        </Box>

        {/* Danger section (pinned to bottom) */}
        <Box className="flex-shrink-0 p-6 pt-0">
          <Box className="flex flex-col gap-3">
            {isConnected && (
              <Button
                variant="danger"
                size="large"
                className="w-full"
                onClick={onReset}
              >
                Delete All Ownables
              </Button>
            )}
            <Button
              variant="danger-outlined"
              size="large"
              className="w-full"
              onClick={onFactoryReset}
            >
              Factory Reset
            </Button>
          </Box>
        </Box>
      </Drawer>
    </>
  );
}
