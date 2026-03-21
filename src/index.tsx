import React, { useEffect } from "react";
import ReactDOM from "react-dom/client";

import "@fontsource/montserrat/300.css";
import "@fontsource/montserrat/400.css";
import "@fontsource/montserrat/500.css";
import "@fontsource/montserrat/700.css";
import "./index.css";

import App from "./App";
import reportWebVitals from "./reportWebVitals";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import "@rainbow-me/rainbowkit/styles.css";
import { RainbowKitProvider, getDefaultConfig } from "@rainbow-me/rainbowkit";
import { WagmiProvider, createConfig, http, mock, useConnect, useAccount } from "wagmi";
import { base, baseSepolia } from "wagmi/chains";
import { ServicesProvider } from "./contexts/Services.context";
import { ProgressProvider } from "./contexts/Progress.context";
import { getE2EAccount } from "./services/E2EWallet";
import { isE2E } from "./utils/isE2E";

const chains = [baseSepolia, base] as const;
const queryClient = new QueryClient();

let wagmiConfig;

if (isE2E) {
  const e2eAccount = getE2EAccount();
  wagmiConfig = createConfig({
    chains,
    connectors: [mock({ accounts: [e2eAccount.address] })],
    transports: {
      [baseSepolia.id]: http(import.meta.env.VITE_BASE_SEPOLIA_RPC_URL || undefined),
      [base.id]: http(import.meta.env.VITE_BASE_MAINNET_RPC_URL || undefined),
    },
  });
} else {
  const walletConnectProjectId = (
    import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || ""
  ).trim();
  if (!walletConnectProjectId) {
    // eslint-disable-next-line no-console
    console.warn(
      "RainbowKit: VITE_WALLETCONNECT_PROJECT_ID is not set. WalletConnect may be unavailable."
    );
  }
  wagmiConfig = getDefaultConfig({
    appName: "Ownable SDK",
    projectId: walletConnectProjectId,
    chains,
    transports: {
      [baseSepolia.id]: http(import.meta.env.VITE_BASE_SEPOLIA_RPC_URL || undefined),
      [base.id]: http(import.meta.env.VITE_BASE_MAINNET_RPC_URL || undefined),
    },
  });
}

function E2EAutoConnect() {
  const { connect, connectors } = useConnect();
  const { isConnected } = useAccount();

  useEffect(() => {
    if (!isConnected && connectors.length > 0) {
      connect({ connector: connectors[0] });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);
root.render(
  <React.StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <ServicesProvider>
            <ProgressProvider>
              {isE2E && <E2EAutoConnect />}
              <App />
            </ProgressProvider>
          </ServicesProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
