import { Box, Switch, Button, Drawer, DrawerHeader, Link } from "@/components/ui";
import { useEffect, useState } from "react";
import { useChainId, useDisconnect } from "wagmi";
import { useService } from "@/hooks/useService";
import { useAnchorAddress } from "@/hooks/useAnchorAddress";
import { useExplorerUrl } from "@/hooks/useExplorerUrl";
import useEqtyToken from "@/hooks/useEqtyToken";
import useEffectiveWallet from "@/hooks/useEffectiveWallet";
import { useDialogs } from "@/contexts/Dialogs.context";
import { isE2E } from "@/utils/isE2E";
import WalletConnectControls from "./WalletConnectControls";
import NetworkBadge from "./NetworkBadge";
import WalletAddress from "./WalletAddress";
import WalletBalance from "./WalletBalance";
import ThemePicker from "./ThemePicker";
import AnchorAllowanceDialog from "./AnchorAllowanceDialog";
import shortId from "@/utils/shortId";
import { ExternalLink } from "lucide-react";
import { enqueueSnackbar } from "notistack";
import { formatUnits } from "viem";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  onReset: () => void;
  onFactoryReset: () => void;
}

export default function Sidebar(props: SidebarProps) {
  const { open, onClose, onReset, onFactoryReset } = props;
  const eventChains = useService("eventChains");
  const eqty = useService("eqty");
  const [anchoring, setAnchoring] = useState(false);
  const [allowance, setAllowance] = useState<bigint>();
  const [isAllowanceDialogOpen, setIsAllowanceDialogOpen] = useState(false);
  const [isAllowanceBusy, setIsAllowanceBusy] = useState(false);
  const { isConnected } = useEffectiveWallet();
  const { disconnect, isPending: isDisconnectPending } = useDisconnect();
  const chainId = useChainId();
  const anchorAddress = useAnchorAddress();
  const { balance: eqtyBalance } = useEqtyToken();
  const { showError } = useDialogs();
  const basescanUrl = useExplorerUrl(chainId, anchorAddress ? `address/${anchorAddress}` : "");
  const allowanceDecimals = eqtyBalance?.decimals ?? 18;
  const allowanceSymbol = eqtyBalance?.symbol || "EQTY";

  useEffect(() => {
    if (eventChains) {
      setAnchoring(eventChains.anchoring);
    }
  }, [eventChains]);

  useEffect(() => {
    eventChains?.setAnchoring(anchoring);
  }, [anchoring, eventChains]);

  useEffect(() => {
    if (!open || !isConnected || !eqty?.getAnchorEqtyAllowance) {
      setAllowance(undefined);
      return;
    }

    let alive = true;
    eqty
      .getAnchorEqtyAllowance()
      .then((value) => {
        if (alive) setAllowance(value);
      })
      .catch((error) => {
        if (!alive) return;
        setAllowance(undefined);
        showError(
          "Failed to load Anchor allowance",
          error instanceof Error ? error.message : String(error)
        );
      });

    return () => {
      alive = false;
    };
  }, [eqty, isConnected, open, showError]);

  const refreshAllowance = async () => {
    if (!eqty?.getAnchorEqtyAllowance) return;
    const value = await eqty.getAnchorEqtyAllowance();
    setAllowance(value);
  };

  const updateAllowance = async (amount: bigint) => {
    if (!eqty?.setAnchorEqtyAllowance) {
      showError("Allowance unavailable", "This wallet cannot update Anchor allowance yet.");
      return;
    }

    try {
      setIsAllowanceBusy(true);
      await eqty.setAnchorEqtyAllowance(amount);
      setAllowance(amount);
      await refreshAllowance();
      enqueueSnackbar(`Anchor allowance set to ${Number(formatUnits(amount, allowanceDecimals)).toFixed(2)} ${allowanceSymbol}`, {
        variant: "success",
      });
      setIsAllowanceDialogOpen(false);
    } catch (error) {
      showError(
        "Failed to update Anchor allowance",
        error instanceof Error ? error.message : String(error)
      );
    } finally {
      setIsAllowanceBusy(false);
    }
  };

  const resetAllowance = async () => {
    await updateAllowance(0n);
  };

  return (
    <>
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
              disabled={isE2E || isDisconnectPending}
            >
              {isDisconnectPending ? "DISCONNECTING..." : "DISCONNECT"}
            </Button>
          )}

          {!isConnected && (
            <Box className="mb-8">
              <WalletConnectControls />
            </Box>
          )}

          {isConnected && (
            <Box className="mb-8 flex items-center justify-between rounded-xl border border-black/10 p-4 dark:border-[#333333]">
              <Box className="pr-4">
                <p className="text-base font-medium text-slate-900 dark:text-slate-100">Anchor events</p>
                {anchorAddress && basescanUrl ? (
                  <Link
                    href={basescanUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-xs text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    {shortId(anchorAddress, 10)} <ExternalLink size={12} className="inline" style={{ verticalAlign: '-1px' }} />
                  </Link>
                ) : (
                  <p className="text-xs text-slate-500 dark:text-slate-400">Enable event anchoring</p>
                )}
                <div className="mt-3 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <span>
                    Allowance:{" "}
                    {allowance === undefined
                      ? `Loading ${allowanceSymbol}...`
                      : `${Number(formatUnits(allowance, allowanceDecimals)).toFixed(2)} ${allowanceSymbol}`}
                  </span>
                  <button
                    type="button"
                    className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                    onClick={() => setIsAllowanceDialogOpen(true)}
                  >
                    change
                  </button>
                </div>
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

      <AnchorAllowanceDialog
        open={isAllowanceDialogOpen}
        onClose={() => setIsAllowanceDialogOpen(false)}
        onSubmit={updateAllowance}
        onReset={resetAllowance}
        currentAllowance={allowance}
        decimals={allowanceDecimals}
        symbol={allowanceSymbol}
        busy={isAllowanceBusy}
      />
    </>
  );
}
