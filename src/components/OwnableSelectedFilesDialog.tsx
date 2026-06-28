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
      <DialogHeader title="Selected files" />
      <DialogContent>
        <Box className="flex flex-col gap-4 pt-2">
          {pendingAttachments.map((attachment) => (
            <Box
              key={attachment.cid}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/40"
            >
              <p className="mb-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                {attachment.originalName}
              </p>
              <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
                {attachment.cid}
              </p>
              <TextField
                label="File name"
                name={`attachment-name-${attachment.cid}`}
                aria-label={`attachment-name-${attachment.cid}`}
                value={attachment.displayName}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  onUpdateAttachmentName(attachment.cid, event.target.value)
                }
              />
            </Box>
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
          {isSubmittingAttachments ? "Submitting…" : "Submit"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
