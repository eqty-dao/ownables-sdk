import type { ChangeEvent } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogHeader,
  TextField,
} from "@/components/ui";

export interface PendingAttachment {
  cid: string;
  displayName: string;
  originalName: string;
  file: File;
}

interface OwnableSelectedFilesDialogProps {
  attachmentError: string | null;
  isSubmittingAttachments: boolean;
  open: boolean;
  pendingAttachments: PendingAttachment[];
  onClose: () => void;
  onSubmit: () => void;
  onUpdateAttachmentName: (cid: string, value: string) => void;
}

export default function OwnableSelectedFilesDialog(
  props: OwnableSelectedFilesDialogProps
) {
  const {
    attachmentError,
    isSubmittingAttachments,
    open,
    pendingAttachments,
    onClose,
    onSubmit,
    onUpdateAttachmentName,
  } = props;

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogHeader title={pendingAttachments.length === 1 ? 'Attach file' : 'Attach files'} />
      <DialogContent>
        <Box className="flex flex-col gap-5">
          {pendingAttachments.map((attachment) => (
            <div
              key={attachment.cid}
            >
              <TextField
                name={`attachment-name-${attachment.cid}`}
                aria-label={`attachment-name-${attachment.cid}`}
                value={attachment.displayName}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  onUpdateAttachmentName(attachment.cid, event.target.value)
                }
              />
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                {attachment.cid}
              </p>
            </div>
          ))}
          {attachmentError ? (
            <p className="text-sm text-red-600 dark:text-red-400">{attachmentError}</p>
          ) : null}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button variant="ghost" onClick={onClose} disabled={isSubmittingAttachments}>
          Cancel
        </Button>
        <Button onClick={onSubmit} disabled={isSubmittingAttachments}>
          {isSubmittingAttachments ? "Adding…" : "Add"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
