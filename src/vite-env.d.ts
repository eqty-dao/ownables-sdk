/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_E2E?: string;
  readonly VITE_E2E_MNEMONIC?: string;
  readonly VITE_E2E_ACCOUNT_INDEX?: string;
  readonly VITE_E2E_RPC_URL?: string;
  readonly VITE_LTO_NETWORK_ID?: string;
  readonly VITE_OWNABLE_EXAMPLES_URL?: string;
  readonly VITE_RELAY?: string;
  readonly VITE_LOCAL?: string;
  readonly VITE_OBUILDER?: string;
  readonly VITE_OBUILDER_API_SECRET_KEY?: string;
  readonly VITE_WALLETCONNECT_PROJECT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
