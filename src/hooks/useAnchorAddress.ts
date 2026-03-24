import { useChainId } from "wagmi";
import { AnchorClient } from "eqty-core";

export function useAnchorAddress(): `0x${string}` | null {
  const chainId = useChainId();
  try {
    return AnchorClient.contractAddress(chainId);
  } catch {
    return null;
  }
}
