import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
    <Dialog open={open} onClose={close} transitionDuration={0}>
      <DialogTitle>{props.title}</DialogTitle>
      <DialogContent
        style={{
          paddingBottom: "0px",
        }}
      >
        {props.TextFieldProps ? (
          <label className="block">
            {props.TextFieldProps.label ? (
              <span className="mb-1 block text-sm text-slate-700">{props.TextFieldProps.label}</span>
            ) : null}
            <div className="relative">
              <input
                className={props.TextFieldProps.className || "w-full rounded-md border border-slate-300 px-3 py-2 pr-10"}
                placeholder={props.TextFieldProps.placeholder}
                autoFocus
                required
                value={address}
                onChange={(e) => {
                  setError(null);
                  setAddress(e.target.value);
                }}
              />
              <IconButton onClick={handlePaste} className="absolute right-1 top-1">
                <Paste />
              </IconButton>
            </div>
            {error ? <small className="mt-1 block text-xs text-red-600">{error}</small> : null}
          </label>
        ) : null}
      </DialogContent>

      <DialogActions>
        <Button onClick={close}>
          {props.cancel || "Cancel"}
        </Button>
        <Button
          onClick={submit}
          className={props.severity === "error" ? "bg-red-600 text-white hover:bg-red-700" : "bg-slate-900 text-white hover:bg-slate-800"}
        >
          {props.ok || "Ok"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
