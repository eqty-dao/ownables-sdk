import { useAccount } from "wagmi";
import { getE2EAccount } from "@/services/E2EWallet";
import { isE2E } from "@/utils/isE2E";

export default function useEffectiveWallet() {
  const account = useAccount();

  return {
    ...account,
    address: isE2E ? getE2EAccount().address : account.address,
    isConnected: isE2E ? true : account.isConnected,
    isConnecting: isE2E ? false : account.isConnecting,
  };
}
