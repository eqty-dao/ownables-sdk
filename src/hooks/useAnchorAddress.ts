import { useChainId } from "wagmi";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const anchorAddresses: Record<number, `0x${string}` | undefined> = {
  8453: import.meta.env.VITE_BASE_MAINNET_ANCHOR_ADDRESS as `0x${string}` | undefined,
  84532: import.meta.env.VITE_BASE_SEPOLIA_ANCHOR_ADDRESS as `0x${string}` | undefined,
};

export function useAnchorAddress(): `0x${string}` | null {
  const chainId = useChainId();
  const address = anchorAddresses[chainId];

  if (!address || address === ZERO_ADDRESS) {
    return null;
  }

  return address;
}
