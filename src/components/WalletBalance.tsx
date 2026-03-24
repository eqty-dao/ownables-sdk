import { Box } from "@/components/ui";
import { useAccount, useBalance } from "wagmi";
import { formatUnits } from "viem";
import useEqtyToken from "@/hooks/useEqtyToken";

interface WalletBalanceProps {
  /** When false, polling is paused. */
  active?: boolean;
}

export default function WalletBalance({ active = true }: WalletBalanceProps) {
  const { address } = useAccount();
  const { data: ethBalance } = useBalance({ address, query: { refetchInterval: active ? 10000 : false } });
  const { balance: eqtyBalance } = useEqtyToken({ address });

  return (
    <>
      <Box>
        <p className="mb-1 text-xs text-slate-500 dark:text-slate-400">ETH Balance</p>
        <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          {ethBalance ? `${Number(formatUnits(ethBalance.value, ethBalance.decimals)).toFixed(4)} ETH` : "— ETH"}
        </p>
      </Box>
      <Box>
        <p className="mb-1 text-xs text-slate-500 dark:text-slate-400">EQTY Balance</p>
        <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          {eqtyBalance != null
            ? `${(Number(eqtyBalance.value) / 10 ** eqtyBalance.decimals).toFixed(2)} EQTY`
            : "— EQTY"}
        </p>
      </Box>
    </>
  );
}
