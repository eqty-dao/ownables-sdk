import { mnemonicToAccount } from "viem/accounts";
import { base, baseSepolia } from "viem/chains";
import { createPublicClient, createWalletClient, http, type PublicClient, type WalletClient } from "viem";

const DEFAULT_E2E_MNEMONIC =
  "test test test test test test test test test test test junk";

function getChainById(chainId: number) {
  switch (chainId) {
    case base.id:
      return base;
    case baseSepolia.id:
      return baseSepolia;
    default:
      throw new Error(`Unsupported chain ID for E2E wallet: ${chainId}`);
  }
}

export function getE2EAccount() {
  const mnemonic = import.meta.env.VITE_E2E_MNEMONIC?.trim() || DEFAULT_E2E_MNEMONIC;
  const indexRaw = import.meta.env.VITE_E2E_ACCOUNT_INDEX;
  const addressIndex = Number.isFinite(Number(indexRaw)) ? Number(indexRaw) : 0;
  return mnemonicToAccount(mnemonic, { addressIndex });
}

export function createE2EViemClients(chainId: number): {
  address: `0x${string}`;
  walletClient: WalletClient;
  publicClient: PublicClient;
} {
  const chain = getChainById(chainId);
  const account = getE2EAccount();
  const rpcUrl = import.meta.env.VITE_E2E_RPC_URL || chain.rpcUrls.default.http[0];

  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(rpcUrl),
  }) as WalletClient;

  const publicClient = createPublicClient({
    chain,
    transport: http(rpcUrl),
  }) as PublicClient;

  return { address: account.address, walletClient, publicClient };
}
