import React, { useEffect, useRef, useState } from "react";
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

const VALID_IMAGE_TYPES = [
  "image/gif",
  "image/webp",
  "image/png",
  "image/jpeg",
  "image/jpg",
];

export default function CreateOwnableDialog({
  open,
  onClose,
  onSuccess,
}: CreateOwnableDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [widgetHtml, setWidgetHtml] = useState("");
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const builderService = useService("builder");

  const resetState = () => {
    setName("");
    setDescription("");
    setWidgetHtml("");
    setThumbnailFile(null);
    setThumbnailPreview(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  useEffect(() => {
    if (!open && !isCreating) {
      resetState();
    }
  }, [open, isCreating]);

  const handleThumbnailChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!VALID_IMAGE_TYPES.includes(file.type)) {
      setError("Invalid file type. Please upload a GIF, WebP, PNG, or JPEG image.");
      return;
    }

    setThumbnailFile(file);
    setError(null);

    const reader = new FileReader();
    reader.onloadend = () => setThumbnailPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

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
    if (!thumbnailFile) {
      setError("Thumbnail image is required");
      return;
    }

    try {
      setIsCreating(true);
      setError(null);
      enqueueSnackbar("Building local ownable package...", { variant: "info" });

      const pkg = await builderService.createOwnable({
        name,
        description,
        thumbnail: thumbnailFile,
        widgetHtml,
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

  return (
    <Dialog open={open} onClose={handleClose}>
      <DialogHeader title="Browser Builder" />
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

          <TextField
            label="Widget HTML"
            value={widgetHtml}
            onChange={(event: any) => setWidgetHtml(event.target.value)}
            className="w-full"
            multiline
            rows={8}
            helperText="Leave blank to use the default widget."
            disabled={isCreating}
          />

          <Box>
            <p className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
              Thumbnail *{" "}
              <span className="font-normal text-slate-400">
                (GIF, WebP, PNG, JPEG)
              </span>
            </p>
            <FileInput
              ref={fileInputRef}
              accept="image/gif,image/webp,image/png,image/jpeg,image/jpg"
              onChange={handleThumbnailChange}
              disabled={isCreating}
              fileName={thumbnailFile?.name}
              placeholder="Choose thumbnail…"
            />
            {thumbnailPreview ? (
              <Box className="mt-3 flex justify-center">
                <img
                  src={thumbnailPreview}
                  alt="Preview"
                  className="max-h-48 max-w-full rounded-lg object-contain"
                />
              </Box>
            ) : null}
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
