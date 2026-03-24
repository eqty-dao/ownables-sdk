const explorerUrls: Record<number, string | undefined> = {
  8453: import.meta.env.VITE_BASE_MAINNET_EXPLORER_URL,
  84532: import.meta.env.VITE_BASE_SEPOLIA_EXPLORER_URL,
};

export function useExplorerUrl(chainId: number, path: string): string | null {
  const base = explorerUrls[chainId];
  if (!base) return null;
  return `${base}/${path}`;
}
