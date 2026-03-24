import {
  Button,
  Dialog,
  DialogHeader,
  DialogContent,
  DialogActions,
  IconButton,
} from "@/components/ui";
import { useState } from "react";
import { AlertColor } from "@/components/ui";
import { ClipboardPaste as Paste } from "lucide-react";

interface PromptDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (address: string, fee?: number | null) => void;
  title: string;
  severity?: AlertColor;
  cancel?: string;
  ok?: string;
  TextFieldProps?: { label?: string; className?: string; placeholder?: string };
  validate?: (value: string) => string;
  fee?: number | null;
  network?: string | null;
  actionType: "transfer" | "delete";
}

export default function PromptDialog(props: PromptDialogProps) {
  const { open, onClose, onSubmit, validate, fee } = props;
  const [address, setAddress] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setError(null);
    setAddress("");
    onClose();
  };

  const submit = () => {
    const validationError = validate && validate(address);
    if (validationError) {
      setError(validationError);
      return;
    }
    onSubmit(address, fee);
    close();
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setAddress(text);
      setError(null);
    } catch (err) {
      console.error("Failed to read clipboard contents: ", err);
    }
  };

  return (
    <Dialog open={open} onClose={close}>
      <DialogHeader title={props.title} />
      <DialogContent className="pt-0">
        {props.TextFieldProps && (
          <label className="block">
            {props.TextFieldProps.label && (
              <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                {props.TextFieldProps.label}
              </span>
            )}
            <div className="relative">
              <input
                className={
                  props.TextFieldProps.className ||
                  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 pr-10 text-sm text-slate-900 outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-[#333] dark:bg-[#252525] dark:text-slate-100"
                }
                placeholder={props.TextFieldProps.placeholder}
                autoFocus
                required
                value={address}
                onChange={(e) => {
                  setError(null);
                  setAddress(e.target.value);
                }}
              />
              <IconButton onClick={handlePaste} className="absolute right-1 top-1/2 -translate-y-1/2">
                <Paste />
              </IconButton>
            </div>
            {error && (
              <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{error}</p>
            )}
          </label>
        )}
      </DialogContent>
      <DialogActions>
        <Button variant="ghost" onClick={close}>
          {props.cancel || "Cancel"}
        </Button>
        <Button
          variant={props.severity === "error" ? "danger" : "primary"}
          onClick={submit}
        >
          {props.ok || "Ok"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
