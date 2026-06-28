import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogHeader,
  FileInput,
  TextField,
} from "@/components/ui";
import { enqueueSnackbar } from "notistack";
import { LoaderCircle } from "lucide-react";
import { useService } from "@/hooks/useService";
import type { TypedPackage } from "@/interfaces/TypedPackage";

interface CreateOwnableDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (pkg: TypedPackage) => void | Promise<void>;
}

export default function CreateOwnableDialog({
  open,
  onClose,
  onSuccess,
}: CreateOwnableDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const builderService = useService("builder");

  const resetState = () => {
    setName("");
    setDescription("");
    setThumbnail(null);
    setError(null);
  };

  useEffect(() => {
    if (!open && !isCreating) {
      resetState();
    }
  }, [open, isCreating]);

  const handleCreate = async () => {
    if (!builderService) {
      enqueueSnackbar("Browser builder not available", { variant: "error" });
      return;
    }
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    if (!description.trim()) {
      setError("Description is required");
      return;
    }

    try {
      setIsCreating(true);
      setError(null);
      enqueueSnackbar("Building dossier package...", { variant: "info" });

      const pkg = await builderService.createOwnable({
        name,
        description,
        ...(thumbnail ? { thumbnail } : {}),
      });

      enqueueSnackbar(`${pkg.title} is ready to issue`, { variant: "success" });
      resetState();
      onClose();
      await onSuccess?.(pkg);
    } catch (cause) {
      const nextError =
        cause instanceof Error ? cause.message : "Package creation failed";
      console.error("Builder error:", cause);
      setError(nextError);
      enqueueSnackbar(`Package creation failed: ${nextError}`, {
        variant: "error",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    if (isCreating) {
      return;
    }

    resetState();
    onClose();
  };

  const handleThumbnailChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextThumbnail = event.target.files?.[0] ?? null;
    setThumbnail(nextThumbnail);
  };

  return (
    <Dialog open={open} onClose={handleClose}>
      <DialogHeader title="Ownable Builder" />
      <DialogContent>
        <Box className="flex flex-col gap-4 pt-2">
          {error ? (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          ) : null}

          <TextField
            label="Name *"
            value={name}
            onChange={(event: any) => setName(event.target.value)}
            className="w-full"
            required
            disabled={isCreating}
          />

          <TextField
            label="Description"
            value={description}
            onChange={(event: any) => setDescription(event.target.value)}
            className="w-full"
            multiline
            rows={3}
            required
            disabled={isCreating}
          />

          <Box className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
              Thumbnail
            </span>
            <FileInput
              accept="image/*"
              disabled={isCreating}
              fileName={thumbnail?.name}
              name="thumbnail-input"
              placeholder="Choose thumbnail…"
              onChange={handleThumbnailChange}
              className="w-full"
            />
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={handleCreate}
          className="bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
          disabled={isCreating}
        >
          {isCreating ? <LoaderCircle className="animate-spin" size={20} /> : null}
          {isCreating ? "Building…" : "Create Ownable"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
