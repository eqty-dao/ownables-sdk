import {
  Box,
  Button,
  IconButton,
  Link,
  Switch, Typography,
} from "@/components/ui/primitives";
import { useEffect, useState } from "react";
import { ArrowLeft as ArrowBack } from "lucide-react";
import { Drawer } from "./ui/drawer";
import ltoLogo from "../assets/ltonetwork.png";
import EventChainService from "../services/EventChain.service";
import WalletConnectControls from "./WalletConnectControls";
import { useAccount, useBalance } from "wagmi"
import useEqtyToken from "../hooks/useEqtyToken"
import { cva } from "class-variance-authority";
import { cn } from "./ui/lib/cn";

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
        false: "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
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
        <Box sx={{ width: 350, p: 2 }} role="presentation">
          <Box component="div">
            <Box sx={{ display: { xs: "inline-flex", sm: "none" } }}>
              <IconButton onClick={onClose} size="small" sx={{ mr: 2 }}>
                <ArrowBack />
              </IconButton>
            </Box>
            <Link href="https://ltonetwork.com" target="_blank">
              <img
                src={ltoLogo}
                alt="LTO Network"
                style={{ width: 150, maxWidth: "100%", verticalAlign: -5 }}
              />
            </Link>
          </Box>

          <Box component="div" sx={{ mt: 2 }}>
            <WalletConnectControls>
              <Box sx={{ mt: 1, mb: 4 }}>
                <Typography variant="body2" fontWeight="strong">Balance</Typography>
                <Typography variant="body2">{Number(ethBalance?.formatted).toFixed(4)} {ethBalance?.symbol}</Typography>
                { eqtyBalance !== undefined && <Typography variant="body2">{Number(eqtyBalance?.formatted).toFixed(0)} {eqtyBalance?.symbol}</Typography> }
              </Box>
            </WalletConnectControls>
          </Box>

          <Box component="div" sx={{ mt: 4 }}>
            <Box
              component="div"
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 2,
                mb: 2,
              }}
            >
              <Box component="div">
                <Typography component="p" sx={{ fontWeight: 600 }}>
                  Anchor events
                </Typography>
                <Typography component="p" sx={{ fontSize: 12, color: "#64748b" }}>
                  Enable event anchoring
                </Typography>
              </Box>
              <Switch checked={anchoring} onChange={(e) => setAnchoring(e.target.checked)} aria-label="Anchor events" />
            </Box>

            <Box component="div" sx={{ display: "flex", gap: 1 }}>
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

        <Box component="div" sx={{ flexGrow: 1 }}></Box>

        <Box sx={{ width: 350, p: 2 }} role="presentation">
          <Box component="div" sx={{ display: "grid", gap: 1 }}>
            <Button
              variant="contained"
              size="small"
              color="error"
              onClick={onReset}
              sx={{ mb: 1 }}
            >
              Delete all Ownables
            </Button>
            <Button
              variant="text"
              size="small"
              color="error"
              fullWidth
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
