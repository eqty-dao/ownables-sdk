import { Box, Button } from "@/components/ui";
import { Copy } from "lucide-react";
import { useAccount } from "wagmi";

export default function WalletAddress() {
  const { address } = useAccount();

  if (!address) return null;

  const shortAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;
  const copyAddress = () => navigator.clipboard.writeText(address);

  return (
    <Box>
      <p className="mb-1 text-xs text-slate-500 dark:text-slate-400">Address</p>
      <div className="flex items-center gap-2">
        <p className="font-mono text-sm text-slate-900 dark:text-slate-100">{shortAddress}</p>
        <Button
          variant="ghost"
          onClick={copyAddress}
          aria-label="Copy address"
          className="h-7 w-7 p-0"
        >
          <Copy className="h-4 w-4" />
        </Button>
      </div>
    </Box>
  );
}
