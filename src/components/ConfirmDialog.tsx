import {Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle} from "@/components/ui";
import {ReactNode} from "react";
import { AlertColor } from "@/components/ui";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  severity?: AlertColor,
  cancel?: string;
  ok?: string;
  children: ReactNode;
}

export default function ConfirmDialog(props: ConfirmDialogProps) {
  const {open, onClose, onConfirm} = props;

  return <Dialog open={open} onClose={onClose}>
    <DialogTitle>{props.title}</DialogTitle>
    <DialogContent>
      <DialogContentText>
        {props.children}
      </DialogContentText>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>{props.cancel || 'Cancel'}</Button>
      <Button
        onClick={() => { onConfirm(); onClose();}}
        autoFocus
        className={props.severity === "error" ? "bg-red-600 text-white hover:bg-red-700" : "bg-slate-900 text-white hover:bg-slate-800"}
      >{props.ok || 'Ok'}</Button>
    </DialogActions>
  </Dialog>
}
