import {
  Box,
  Button,
  IconButton,
  Link,
  Switch,
} from "@/components/ui";
import { useEffect, useState } from "react";
import { ArrowLeft as ArrowBack, X as CloseIcon } from "lucide-react";
import { Drawer } from "@/components/ui";
import ownablesLogo from "../assets/logo.svg";
import EventChainService from "../services/EventChain.service";
import WalletConnectControls from "./WalletConnectControls";
import { useAccount, useBalance } from "wagmi"
import useEqtyToken from "../hooks/useEqtyToken"
import { cva } from "class-variance-authority";
import { cn } from "../utils/cn";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  onReset: () => void;
  onFactoryReset: () => void;
}

type ThemeMode = "light" | "dark" | "system";

const modeButton = cva(
  "flex-1 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors",
  {
    variants: {
      active: {
        true: "border-slate-900 bg-slate-900 text-white",
        false: "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800",
      },
    },
    defaultVariants: {
      active: false,
    },
  }
);

const sidebarButton = cva("w-full", {
  variants: {
    tone: {
      danger: "mb-1 bg-red-600 text-white hover:bg-red-700",
      subtleDanger: "text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40",
    },
  },
});

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
  const { address } = useAccount();
  // Only poll balances when sidebar is open to avoid constant RPC calls
  const { data: ethBalance } = useBalance({ address, formatUnits: 'ether', watch: open });
  const { balance: eqtyBalance } = useEqtyToken({ address, watch: open });

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

  return (
    <>
      <Drawer anchor="right" open={open} onClose={onClose}>
        <Box className="w-[350px] p-2" role="presentation">
          <Box className="flex items-start justify-between">
            <Box className="inline-flex sm:hidden">
              <IconButton onClick={onClose} size="small" className="mr-2">
                <ArrowBack />
              </IconButton>
            </Box>
            <Link href="https://ownables.info" target="_blank">
              <img
                src={ownablesLogo}
                alt="Ownables"
                style={{ width: 150, maxWidth: "100%", verticalAlign: -5 }}
              />
            </Link>
            <IconButton onClick={onClose} size="small" className="ml-2">
              <CloseIcon className="h-4 w-4" />
            </IconButton>
          </Box>

          <Box className="mt-2">
            <WalletConnectControls>
              <Box className="mb-4 mt-1">
                <p className="text-body font-semibold">Balance</p>
                <p className="text-body">{Number(ethBalance?.formatted).toFixed(4)} {ethBalance?.symbol}</p>
                { eqtyBalance !== undefined && <p className="text-body">{Number(eqtyBalance?.formatted).toFixed(0)} {eqtyBalance?.symbol}</p> }
              </Box>
            </WalletConnectControls>
          </Box>

          <Box className="mt-4">
            <Box className="mb-2 flex items-center justify-between gap-2">
              <Box>
                <p className="text-body font-semibold">
                  Anchor events
                </p>
                <p className="text-caption">
                  Enable event anchoring
                </p>
              </Box>
              <Switch checked={anchoring} onChange={(e) => setAnchoring(e.target.checked)} aria-label="Anchor events" />
            </Box>

            <Box className="flex gap-1">
              <Button
                type="button"
                className={cn(modeButton({ active: themeMode === "light" }))}
                onClick={() => setThemeMode("light")}
              >
                Light
              </Button>
              <Button
                type="button"
                className={cn(modeButton({ active: themeMode === "dark" }))}
                onClick={() => setThemeMode("dark")}
              >
                Dark
              </Button>
              <Button
                type="button"
                className={cn(modeButton({ active: themeMode === "system" }))}
                onClick={() => setThemeMode("system")}
              >
                System
              </Button>
            </Box>
          </Box>
        </Box>

        <Box className="grow"></Box>

        <Box className="w-[350px] p-2" role="presentation">
          <Box className="grid gap-1">
            <Button
              size="small"
              className={cn(sidebarButton({ tone: "danger" }))}
              onClick={onReset}
            >
              Delete all Ownables
            </Button>
            <Button
              size="small"
              className={cn(sidebarButton({ tone: "subtleDanger" }))}
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
