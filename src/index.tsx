import React from "react";
import ReactDOM from "react-dom/client";

import "@fontsource/montserrat/300.css";
import "@fontsource/montserrat/400.css";
import "@fontsource/montserrat/500.css";
import "@fontsource/montserrat/700.css";
import "./index.css";

import App from "./App";
import reportWebVitals from "./reportWebVitals";
import { createTheme, ThemeProvider } from "@/components/ui/primitives";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import "@rainbow-me/rainbowkit/styles.css";
import { RainbowKitProvider, getDefaultConfig } from "@rainbow-me/rainbowkit";
import { WagmiProvider, http } from "wagmi";
import { base, baseSepolia } from "wagmi/chains";
import { ServicesProvider } from "./contexts/Services.context";
import { ProgressProvider } from "./contexts/Progress.context";

const theme = createTheme({
  palette: {
    primary: {
      main: "#1caaff",
      contrastText: "#ffffff",
    },
    secondary: {
      main: "#666666",
    },
  },
});

const chains = [baseSepolia, base] as const;
const queryClient = new QueryClient();

// Use RainbowKit's default wallet connectors to populate the wallet list (WalletConnect, MetaMask, Coinbase, Ledger, etc.)
const walletConnectProjectId = (
  import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || ""
).trim();
if (!walletConnectProjectId) {
  // eslint-disable-next-line no-console
  console.warn(
    "RainbowKit: VITE_WALLETCONNECT_PROJECT_ID is not set. WalletConnect may be unavailable."
  );
}
const wagmiConfig = getDefaultConfig({
  appName: "Ownable SDK",
  projectId: walletConnectProjectId,
  chains,
  transports: {
    [baseSepolia.id]: http(),
    [base.id]: http(),
  },
});

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);
root.render(
  <React.StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <ServicesProvider>
            <ThemeProvider theme={theme}>
              <ProgressProvider>
                <App />
              </ProgressProvider>
            </ThemeProvider>
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
