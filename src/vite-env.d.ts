/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_E2E?: string;
  readonly VITE_E2E_MNEMONIC?: string;
  readonly VITE_E2E_ACCOUNT_INDEX?: string;
  readonly VITE_E2E_RPC_URL?: string;
  readonly VITE_OWNABLE_EXAMPLES_URL?: string;
  readonly VITE_RELAY?: string;
  readonly VITE_LOCAL?: string;
  readonly VITE_BUILDER?: string;
  readonly VITE_BUILDER_SERVER_WALLETS_ENDPOINT?: string;
  readonly VITE_BUILDER_NETWORK_PARAM?: string;
  readonly VITE_WALLETCONNECT_PROJECT_ID?: string;
  readonly VITE_BASE_SEPOLIA_RPC_URL?: string;
  readonly VITE_BASE_MAINNET_RPC_URL?: string;
  readonly VITE_BASE_SEPOLIA_EXPLORER_URL?: string;
  readonly VITE_BASE_MAINNET_EXPLORER_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
