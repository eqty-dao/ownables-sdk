import { Button, Dialog, DialogHeader, DialogContent, DialogContentText, DialogActions } from "@/components/ui";
import { ReactNode } from "react";
import { AlertColor } from "@/components/ui";

interface AlertDialogProps {
  open: boolean;
  onClose: () => void;
  severity?: AlertColor;
  title?: string;
  children: ReactNode;
}

export default function AlertDialog(props: AlertDialogProps) {
  const { open, onClose } = props;

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogHeader title={props.title ?? ""} />
      <DialogContent className="pt-0">
        <DialogContentText>{props.children}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button variant="primary" onClick={onClose}>
          Ok
        </Button>
      </DialogActions>
    </Dialog>
  );
}
