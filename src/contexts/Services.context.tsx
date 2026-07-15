import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ServiceContainer from "@/services/ServiceContainer";
import {
  useAccount,
  useChainId,
  useWalletClient,
  usePublicClient,
} from "wagmi";
import { getE2EAccount } from "@/utils/E2EWallet";
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
  const containerRef = useRef<ServiceContainer | null>(null);
  const generationRef = useRef(0);

  useEffect(() => {
    const generation = ++generationRef.current;
    let cancelled = false;

    (async () => {
      const current = containerRef.current;
      if (key && current?.key === key) {
        return;
      }

      containerRef.current = null;
      setContainer(null);
      if (current) {
        await current.dispose().catch(() => {});
      }

      if (!key || cancelled || generationRef.current !== generation) return;

      const instance = new ServiceContainer(
        address!,
        chainId,
        walletClient.data || undefined,
        publicClient || undefined
      );
      if (!cancelled && generationRef.current === generation) {
        containerRef.current = instance;
        setContainer(instance);
      } else {
        await instance.dispose().catch(() => {});
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [key, address, chainId, walletClient.data, publicClient]);

  // Dispose on unmount
  useEffect(() => {
    return () => {
      const current = containerRef.current;
      containerRef.current = null;
      current?.dispose().catch(() => {});
    };
  }, []);

  const ctx = useMemo<Ctx>(() => ({ container }), [container]);

  return (
    <ServicesContext.Provider value={ctx}>{children}</ServicesContext.Provider>
  );
};

export function useContainer(): ServiceContainer | null {
  return useContext(ServicesContext).container;
}

export default ServicesContext;
