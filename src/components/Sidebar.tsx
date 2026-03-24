import { Box, Switch, Button, Drawer, DrawerHeader, Link } from "@/components/ui";
import { useEffect, useState } from "react";
import { useAccount, useChainId, useDisconnect } from "wagmi";
import EventChainService from "@/services/EventChain.service";
import { useAnchorAddress } from "@/hooks/useAnchorAddress";
import { useExplorerUrl } from "@/hooks/useExplorerUrl";
import WalletConnectControls from "./WalletConnectControls";
import NetworkBadge from "./NetworkBadge";
import WalletAddress from "./WalletAddress";
import WalletBalance from "./WalletBalance";
import ThemePicker from "./ThemePicker";
import shortId from "@/utils/shortId";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  onReset: () => void;
  onFactoryReset: () => void;
}

export default function Sidebar(props: SidebarProps) {
  const { open, onClose, onReset, onFactoryReset } = props;
  const [anchoring, setAnchoring] = useState(EventChainService.anchoring);
  const { isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const anchorAddress = useAnchorAddress();
  const basescanUrl = useExplorerUrl(chainId, anchorAddress ? `address/${anchorAddress}` : "");

  useEffect(() => {
    EventChainService.anchoring = anchoring;
  }, [anchoring]);

  return (
    <Drawer anchor="right" open={open} onClose={onClose} className="flex w-[384px] flex-col overflow-hidden">
      <DrawerHeader title="Settings" closeAriaLabel="Close settings" />

      {/* Scrollable content */}
      <Box className="flex flex-1 flex-col overflow-y-auto p-6">

        {isConnected && (
          <div className="mb-8">
            <NetworkBadge />
          </div>
        )}

        {isConnected && (
          <Box className="mb-8 flex flex-col gap-4">
            <WalletAddress />
            <WalletBalance active={open} />
          </Box>
        )}

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

        {!isConnected && (
          <Box className="mb-8">
            <WalletConnectControls />
          </Box>
        )}

        {isConnected && (
          <Box className="mb-8 flex items-center justify-between rounded-xl border border-black/10 p-4 dark:border-[#333333]">
            <Box>
              <p className="text-base font-medium text-slate-900 dark:text-slate-100">Anchor events</p>
              {anchorAddress && basescanUrl ? (
                <Link
                  href={basescanUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  {shortId(anchorAddress, 10)}
                </Link>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400">Enable event anchoring</p>
              )}
            </Box>
            <Switch checked={anchoring} onChange={(e) => setAnchoring(e.target.checked)} aria-label="Anchor events" />
          </Box>
        )}

        <ThemePicker />
      </Box>

      {/* Danger section (pinned to bottom) */}
      <Box className="shrink-0 p-6 pt-0">
        <Box className="flex flex-col gap-3">
          {isConnected && (
            <Button variant="danger" size="large" className="w-full" onClick={onReset}>
              Delete All Ownables
            </Button>
          )}
          <Button variant="danger-outlined" size="large" className="w-full" onClick={onFactoryReset}>
            Factory Reset
          </Button>
        </Box>
      </Box>
    </Drawer>
  );
}
