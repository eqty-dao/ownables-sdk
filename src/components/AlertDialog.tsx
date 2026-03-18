import {
  Alert,
  AlertTitle, Box,
  Button,
  Dialog,
  DialogActions,
} from "@/components/ui";
import {ReactNode} from "react";
import { AlertColor } from "@/components/ui";

interface AlertDialogProps {
  open: boolean;
  onClose: () => void;
  severity?: AlertColor,
  title?: string;
  children: ReactNode;
}

export default function AlertDialog(props: AlertDialogProps) {
  const {open, onClose, severity} = props;

  return <Dialog open={open} onClose={onClose} transitionDuration={0}>
    <Alert className="rounded-xl border border-slate-200 bg-white p-4" severity={severity || 'info'}>
      <AlertTitle>{props.title}</AlertTitle>
      <Box className="pr-3">{ props.children }</Box>
      <DialogActions className="pb-0">
        <Button size="small" onClick={onClose}>Ok</Button>
      </DialogActions>
    </Alert>
  </Dialog>
}
