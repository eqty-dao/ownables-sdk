import { Button } from '@/components/ui';
import { Info as InfoOutlineIcon, RefreshCcw as CachedIcon } from "lucide-react";
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useDisconnect } from 'wagmi';
import { PropsWithChildren } from "react"

export default function WalletConnectControls({ children }: PropsWithChildren) {
  const { disconnect, isLoading } = useDisconnect();

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
            <>
              <Button className="w-full bg-slate-900 text-white hover:bg-slate-800" onClick={openConnectModal}>
                Connect to wallet
              </Button>
              <p
                className="mt-1 block text-center text-xs text-slate-500"
              >
                Ensure to connect on <strong>Base Sepolia</strong> testnet
              </p>
            </>
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
            <p className="cursor-pointer text-xs text-slate-500" onClick={openChainModal}>
              {chain?.name || 'Network'} address <CachedIcon className="inline h-3 w-3" />
            </p>
            <p className="cursor-pointer text-sm font-semibold" onClick={openAccountModal}>
              {account?.displayName} <InfoOutlineIcon className="inline h-3.5 w-3.5" />
            </p>
            {children}
            <Button className="w-full bg-slate-900 text-white hover:bg-slate-800" onClick={() => disconnect()} disabled={isLoading}>
              {isLoading ? 'Disconnecting…' : 'Disconnect'}
            </Button>
          </>
        );
      }}
    </ConnectButton.Custom>
  );
}
