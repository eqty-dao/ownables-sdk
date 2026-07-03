import { useAccount, useBalance, useChainId } from "wagmi";

export type EqtyTokenBalance = { address?: string; balance?: { value: bigint; decimals: number; symbol: string } };
type UseBalanceParameters = Parameters<typeof useBalance>[0];

const BASE_CHAIN_ID = 8453;
const BASE_SEPOLIA_CHAIN_ID = 84532;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const eqtyTokenAddresses: Record<number, `0x${string}` | undefined> = {
  [BASE_CHAIN_ID]: import.meta.env.VITE_BASE_MAINNET_EQTY_TOKEN_ADDRESS as `0x${string}` | undefined,
  [BASE_SEPOLIA_CHAIN_ID]:
    import.meta.env.VITE_BASE_SEPOLIA_EQTY_TOKEN_ADDRESS as `0x${string}` | undefined,
};

/**
 * useEqtyToken
 * Returns { address, balance } for EQTY token on Base or Base Sepolia.
 * If chain is unsupported or token address is zero, returns {}.
 *
 * Params mirror wagmi's useBalance. You can override `address` and `chainId`.
 */
export default function useEqtyToken(params?: UseBalanceParameters): EqtyTokenBalance {
  const chainIdCtx = useChainId();
  const { address: currentAddress } = useAccount();

  const effectiveChainId = params?.chainId ?? chainIdCtx;
  const account = params?.address ?? currentAddress;

  const tokenAddress = effectiveChainId
    ? eqtyTokenAddresses[effectiveChainId]
    : undefined;
  const isSupported =
    !!effectiveChainId &&
    !!account &&
    !!tokenAddress &&
    tokenAddress !== ZERO_ADDRESS;

  // Call wagmi's useBalance only when supported; leverage query.enabled to gate fetching
  const balanceQuery = useBalance({
    ...(params ?? {}),
    address: account as `0x${string}`,
    chainId: effectiveChainId,
    token: tokenAddress as `0x${string}` | undefined,
    query: { enabled: isSupported },
  });

  if (!isSupported) return {};

  const data = balanceQuery.data;
  const balance = data ? { value: data.value, decimals: data.decimals, symbol: data.symbol } : undefined;
  return { address: tokenAddress!, balance };
}
