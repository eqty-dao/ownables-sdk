import type { ChangeEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { formatUnits, parseUnits } from "viem";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogHeader,
  TextField,
} from "@/components/ui";

interface AnchorAllowanceDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (amount: bigint) => Promise<void>;
  onReset: () => Promise<void>;
  currentAllowance?: bigint;
  decimals?: number;
  symbol?: string;
  busy?: boolean;
}

function formatAllowance(amount: bigint, decimals: number, symbol: string) {
  return `${Number(formatUnits(amount, decimals)).toFixed(2)} ${symbol}`;
}

export default function AnchorAllowanceDialog({
  open,
  onClose,
  onSubmit,
  onReset,
  currentAllowance,
  decimals = 18,
  symbol = "EQTY",
  busy = false,
}: AnchorAllowanceDialogProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setValue("");
      setError(null);
      return;
    }

    if (currentAllowance === undefined) {
      setValue("");
      return;
    }

    setValue(formatUnits(currentAllowance, decimals));
    setError(null);
  }, [currentAllowance, decimals, open]);

  const currentLabel = useMemo(() => {
    if (currentAllowance === undefined) {
      return `Loading ${symbol} allowance...`;
    }

    return formatAllowance(currentAllowance, decimals, symbol);
  }, [currentAllowance, decimals, symbol]);

  const handleSubmit = async () => {
    try {
      const nextAmount = parseUnits(value.trim(), decimals);
      setError(null);
      await onSubmit(nextAmount);
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : "Enter a valid allowance amount."
      );
    }
  };

  const handleReset = async () => {
    setError(null);
    await onReset();
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose}>
      <DialogHeader title="Anchor allowance" closeAriaLabel="Close Anchor allowance" />
      <DialogContent className="pt-0">
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-black/10 bg-slate-50 p-4 dark:border-[#333333] dark:bg-[#1d1d1d]">
            <p className="mb-1 text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
              Current allowance
            </p>
            <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{currentLabel}</p>
          </div>

          <TextField
            label={`Allowance amount (${symbol})`}
            placeholder="0.00"
            inputMode="decimal"
            autoFocus
            value={value}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              setValue(event.target.value);
              setError(null);
            }}
            error={Boolean(error)}
            helperText={error ?? `Set the exact ${symbol} allowance for the Anchor contract.`}
          />
        </div>
      </DialogContent>
      <DialogActions>
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          Close
        </Button>
        <Button variant="danger-outlined" onClick={() => void handleReset()} disabled={busy}>
          Reset to zero
        </Button>
        <Button variant="primary" onClick={() => void handleSubmit()} disabled={busy}>
          Save allowance
        </Button>
      </DialogActions>
    </Dialog>
  );
}
