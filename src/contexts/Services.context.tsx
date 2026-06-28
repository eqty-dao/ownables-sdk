import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { RelayService } from "@ownables/platform-browser";
import ServiceContainer from "@/services/ServiceContainer";
import {
  useAccount,
  useChainId,
  useWalletClient,
  usePublicClient,
} from "wagmi";
import { getE2EAccount } from "@/services/E2EWallet";
import { isE2E } from "@/utils/isE2E";

type Ctx = { container: ServiceContainer | null };
const ServicesContext = createContext<Ctx>({ container: null });

export const ServicesProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { address: walletAddress } = useAccount();
  const chainId = useChainId();
  const address = isE2E ? getE2EAccount().address : walletAddress;
  const walletClient = useWalletClient();
  const publicClient = usePublicClient();
  const isWalletReady = isE2E || (!!walletClient.data && !!publicClient);

  const key =
    address && chainId && isWalletReady
      ? `${address}:${chainId}`
      : null;

  const [container, setContainer] = useState<ServiceContainer | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // No identity yet, clear any existing container
      if (!key) {
        if (container) {
          await container.dispose().catch(() => {});
        }
        if (!cancelled) setContainer(null);
        return;
      }

      // Same key, keep current container
      if (container?.key === key) {
        return;
      }

      // Replace previous
      if (container) {
        const [oldAddress, oldChainId] = container.key.split(":");
        if (oldAddress && oldChainId) {
          RelayService.clearWalletAuth(oldAddress, parseInt(oldChainId));
        }
        await container.dispose().catch(() => {});
      }

      const instance = new ServiceContainer(
        address!,
        chainId,
        walletClient.data || undefined,
        publicClient || undefined
      );
      if (!cancelled) {
        setContainer(instance);
      } else {
        await instance.dispose().catch(() => {});
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, address, chainId, isWalletReady, publicClient]);

  // Dispose on unmount
  useEffect(() => {
    return () => {
      container?.dispose().catch(() => {});
    };
  }, [container]);

  const ctx = useMemo<Ctx>(() => ({ container }), [container]);

  return (
    <ServicesContext.Provider value={ctx}>{children}</ServicesContext.Provider>
  );
};

export function useContainer(): ServiceContainer | null {
  return useContext(ServicesContext).container;
}

export default ServicesContext;
