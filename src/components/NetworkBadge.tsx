import { useAccount } from "wagmi";
import { useChainModal } from "@rainbow-me/rainbowkit";

export default function NetworkBadge() {
  const { chain } = useAccount();
  const { openChainModal } = useChainModal();

  if (!chain) return null;

  return (
    <button
      type="button"
      onClick={() => openChainModal?.()}
      className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 transition-colors hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/30 dark:hover:bg-indigo-950/50"
      title="Click to switch network"
    >
      <span className="h-2 w-2 rounded-full bg-indigo-600 dark:bg-indigo-400" />
      <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
        {chain.name?.toUpperCase() ?? "NETWORK"}
      </span>
    </button>
  );
}
