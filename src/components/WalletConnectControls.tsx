import { Button } from '@/components/ui';
import { Info as InfoOutlineIcon, RefreshCcw as CachedIcon } from "lucide-react";
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useDisconnect } from 'wagmi';
import { PropsWithChildren } from "react"
import { cva } from "class-variance-authority";
import { cn } from "@/utils/cn";

const primaryWalletButton = cva("w-full");

export default function WalletConnectControls({ children }: PropsWithChildren) {
  const { disconnect, isPending: isLoading } = useDisconnect();

  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        authenticationStatus,
        mounted,
      }) => {
        const ready = mounted && authenticationStatus !== 'loading';
        const connected =
          ready && account && chain && (!authenticationStatus || authenticationStatus === 'authenticated');

        if (!connected) {
          return (
            <Button variant="primary" size="large" className={cn(primaryWalletButton())} onClick={openConnectModal}>
              Connect to wallet
            </Button>
          );
        }

        if (chain?.unsupported) {
          return (
            <Button className="w-full bg-amber-500 text-white hover:bg-amber-600" onClick={openChainModal}>
              Wrong network — Switch
            </Button>
          );
        }

        return (
          <>
            <p className="cursor-pointer text-xs text-slate-500 dark:text-slate-400" onClick={openChainModal}>
              {chain?.name || 'Network'} address <CachedIcon className="inline h-3 w-3" />
            </p>
            <p className="cursor-pointer text-sm font-semibold text-slate-900 dark:text-slate-100" onClick={openAccountModal}>
              {account?.displayName} <InfoOutlineIcon className="inline h-3.5 w-3.5" />
            </p>
            {children}
            <Button className={cn(primaryWalletButton())} onClick={() => disconnect()} disabled={isLoading}>
              {isLoading ? 'Disconnecting…' : 'Disconnect'}
            </Button>
          </>
        );
      }}
    </ConnectButton.Custom>
  );
}
