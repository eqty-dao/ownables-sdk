import { Button, Dialog, DialogHeader, DialogContent, DialogContentText, DialogActions } from "@/components/ui";
import { ReactNode } from "react";
import { AlertColor } from "@/components/ui";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  severity?: AlertColor;
  cancel?: string;
  ok?: string;
  children: ReactNode;
}

export default function ConfirmDialog(props: ConfirmDialogProps) {
  const { open, onClose, onConfirm } = props;

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogHeader title={props.title} />
      <DialogContent className="pt-0">
        <DialogContentText>{props.children}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button variant="ghost" onClick={onClose}>
          {props.cancel || "Cancel"}
        </Button>
        <Button
          variant={props.severity === "error" ? "danger" : "primary"}
          onClick={() => { onConfirm(); onClose(); }}
          autoFocus
        >
          {props.ok || "Ok"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
