import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogHeader,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  CircularProgress,
  Alert,
  FileInput,
} from "@/components/ui";
import { enqueueSnackbar } from "notistack";
import { useService } from "@/hooks/useService";
import { useAccount, useChainId } from "wagmi";
import { parseEther } from "viem";

interface CreateOwnableDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function CreateOwnableDialog({
  open,
  onClose,
  onSuccess,
}: CreateOwnableDialogProps) {
  const [name, setName] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [templateCost, setTemplateCost] = useState<{
    eth: string;
    usd?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [descriptionError, setDescriptionError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const builderService = useService("builder");
  const { address } = useAccount();
  const chainId = useChainId();
  const hasFetchedRef = useRef(false);

  const DEFAULT_TEMPLATE_ID = 1;
  const BASE_SEPOLIA_CHAIN_ID = 84532;
  const isTestnet = chainId === BASE_SEPOLIA_CHAIN_ID;

  // Load template cost when dialog opens (only once per open)
  useEffect(() => {
    if (!open || !builderService) {
      hasFetchedRef.current = false;
      return;
    }

    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    let cancelled = false;

    builderService
      .getTemplateCost(DEFAULT_TEMPLATE_ID)
      .then((cost) => { if (!cancelled) setTemplateCost(cost); })
      .catch((err) => { if (!cancelled) console.error("Failed to load template cost:", err); });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    const sanitized = inputValue.replace(/[^a-zA-Z0-9]/g, "");
    setName(sanitized);
    if (inputValue !== sanitized) {
      setNameError("Name can only contain letters and numbers (no spaces, emojis, or special characters)");
    } else {
      setNameError(null);
    }
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    const sanitized = inputValue.replace(/[^\w\s.,!?'-]/g, "");
    setDescription(sanitized);
    if (inputValue !== sanitized) {
      setDescriptionError("Description cannot contain emojis or special characters");
    } else {
      setDescriptionError(null);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ["image/gif", "image/webp", "image/png", "image/jpeg", "image/jpg"];
    if (!validTypes.includes(file.type)) {
      setError("Invalid file type. Please upload a GIF, WebP, PNG, or JPEG image.");
      return;
    }

    setImageFile(file);
    setError(null);

    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!builderService) {
      enqueueSnackbar("Builder service not available", { variant: "error" });
      return;
    }
    if (!name.trim()) { setError("Name is required"); return; }
    if (!imageFile) { setError("Image is required"); return; }
    if (!address) { setError("Wallet not connected"); return; }

    const eth = (window as any).ethereum;
    if (!eth) { setError("MetaMask not found"); return; }

    try {
      setError(null);

      const networkCode = builderService.getNetworkCode();
      const expectedChainId = networkCode === "L" ? "0x2105" : "0x14a34";

      try {
        await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: expectedChainId }] });
      } catch (switchError: any) {
        if (switchError?.code === 4902) {
          throw new Error(`Please add Base ${networkCode === "L" ? "Mainnet" : "Sepolia"} to MetaMask first`);
        }
        throw switchError;
      }

      let txHash: string | undefined;

      if (!isTestnet) {
        setIsProcessingPayment(true);

        const serverAddress = await builderService.getAddress();
        if (!serverAddress || !serverAddress.startsWith("0x") || serverAddress.length !== 42) {
          throw new Error(`Invalid server wallet address: ${serverAddress}`);
        }

        const cost = templateCost?.eth || "0.001";
        const costWei = parseEther(cost);
        const costHex = `0x${costWei.toString(16)}`;

        enqueueSnackbar("Please confirm the transaction in MetaMask...", { variant: "info" });

        txHash = (await eth.request({
          method: "eth_sendTransaction",
          params: [{ from: address, to: serverAddress, value: costHex, gas: "0x5208" }],
        })) as string;

        enqueueSnackbar(`Payment sent! TX: ${txHash.slice(0, 10)}...`, { variant: "success" });
      }

      setIsProcessingPayment(false);
      setIsUploading(true);

      enqueueSnackbar("Creating ownable package...", { variant: "info" });

      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();

      const imageExtension = imageFile.name.split(".").pop()?.toLowerCase();
      const ownableData: any = {
        PLACEHOLDER1_NAME: name.toLowerCase().replace(/[^a-z0-9]/g, ""),
        PLACEHOLDER1_DESCRIPTION: description || "",
        PLACEHOLDER1_VERSION: "1.0.0",
        PLACEHOLDER1_AUTHORS: address,
        PLACEHOLDER1_KEYWORDS: [],
        templateId: DEFAULT_TEMPLATE_ID,
        PLACEHOLDER4_TYPE: "basic",
        PLACEHOLDER4_DESCRIPTION: description || "",
        PLACEHOLDER4_NAME: name,
        PLACEHOLDER2_IMG: `image.${imageExtension}`,
        PLACEHOLDER2_TITLE: name,
        OWNABLE_THUMBNAIL: `image.${imageExtension}`,
        CREATE_NFT: "true",
        NFT_BLOCKCHAIN: "base",
        generatedAt: new Date().toISOString(),
      };
      if (txHash) ownableData.OWNABLE_BASE_TRANSACTION_ID = txHash;

      zip.file("ownableData.json", JSON.stringify([ownableData], null, 2));
      zip.file(`image.${imageExtension}`, imageFile);
      zip.file("chain.json", JSON.stringify({ networkId: networkCode, timestamp: Date.now(), version: "1.0.0" }, null, 2));

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const zipArray = new Uint8Array(await zipBlob.arrayBuffer());

      enqueueSnackbar("Uploading to builder...", { variant: "info" });

      const uploadOptions: any = { templateId: DEFAULT_TEMPLATE_ID, name, sender: address };
      if (txHash) uploadOptions.signedTransaction = txHash;

      const result = await builderService.upload(zipArray, uploadOptions);

      enqueueSnackbar(`Ownable uploaded successfully! Request ID: ${result.requestId}`, { variant: "success" });

      setName("");
      setDescription("");
      setImageFile(null);
      setImagePreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      onClose();
      if (onSuccess) onSuccess();
    } catch (error: any) {
      console.error("Upload error:", error);
      setError(error.message || "Upload failed");
      enqueueSnackbar(`Upload failed: ${error.message || "Unknown error"}`, { variant: "error" });
    } finally {
      setIsProcessingPayment(false);
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    if (!isUploading && !isProcessingPayment) {
      setName("");
      setDescription("");
      setImageFile(null);
      setImagePreview(null);
      setError(null);
      setNameError(null);
      setDescriptionError(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      onClose();
    }
  };

  const busy = isUploading || isProcessingPayment;

  return (
    <Dialog open={open} onClose={handleClose} className="w-[min(560px,calc(100vw-32px))]">
      <DialogHeader title="Create Ownable" />
      <DialogContent>
        <Box className="flex flex-col gap-4 pt-2">
          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <TextField
            label="Name *"
            value={name}
            onChange={handleNameChange}
            className="w-full"
            required
            disabled={busy}
            helperText={nameError || "Only letters and numbers allowed"}
            error={!!nameError}
          />

          <TextField
            label="Description"
            value={description}
            onChange={handleDescriptionChange}
            className="w-full"
            multiline
            rows={3}
            disabled={busy}
            helperText={descriptionError || "Letters, numbers, spaces, and basic punctuation only"}
            error={!!descriptionError}
          />

          <Box>
            <p className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
              Image * <span className="font-normal text-slate-400">(GIF, WebP, PNG, JPEG)</span>
            </p>
            <FileInput
              ref={fileInputRef}
              accept="image/gif,image/webp,image/png,image/jpeg,image/jpg"
              onChange={handleImageChange}
              disabled={busy}
              fileName={imageFile?.name}
              placeholder="Choose image…"
            />
            {imagePreview && (
              <Box className="mt-3 flex justify-center">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="max-h-48 max-w-full rounded-lg object-contain"
                />
              </Box>
            )}
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={handleUpload}
          className="bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
          disabled={busy || !name.trim() || !imageFile}
        >
          {busy ? <CircularProgress size={20} /> : null}
          {isProcessingPayment ? "Processing Payment…" : isUploading ? "Uploading…" : "Create Ownable"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
