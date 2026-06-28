import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EventChain } from "eqty-core";
import { TypedOwnableInfo } from "@/interfaces/TypedOwnableInfo";
import { TypedPackage } from "@/interfaces/TypedPackage";
import { useService } from "@/hooks/useService";
import { useOwnableState } from "@/hooks/useOwnableState";
import { useOwnableTransfer } from "@/hooks/useOwnableTransfer";
import { useDialogs } from "@/contexts/Dialogs.context";
import { maybePackageInfo } from "@/utils/maybePackageInfo";
import calculateFileCid from "@/utils/calculateFileCid";
import OwnableSelectedFilesDialog, {
  PendingAttachment,
} from "./OwnableSelectedFilesDialog";
import OwnableDetail from "./OwnableDetail";

interface OwnableProps {
  chain: EventChain;
  packageCid: string;
  selected: boolean;
  uniqueMessageHash?: string;
  archived?: boolean;
  isHubAvailable?: boolean;
  onBack: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onDelete: () => void;
  onConsume: (info: TypedOwnableInfo) => void;
  onTransferred: () => void;
  onError: (title: string, message: string) => void;
}

export default function Ownable(props: OwnableProps) {
  const { chain, packageCid, uniqueMessageHash } = props;
  const [isSubmittingAttachments, setIsSubmittingAttachments] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);

  const packages = useService("packages");
  const idb = useService("idb");
  const ownables = useService("ownables");
  const eventChains = useService("eventChains");

  const pkg: TypedPackage | undefined = useMemo(() => {
    return maybePackageInfo(packages, packageCid, uniqueMessageHash);
  }, [packages, packageCid, uniqueMessageHash]);

  const {
    iframeRef,
    info,
    metadata,
    attachments,
    isConsumed,
    isClosed,
    isLocked,
    isTransferred,
    execute,
    onLoad,
  } = useOwnableState(chain, pkg, props.onError);

  const { transfer } = useOwnableTransfer(chain, pkg, execute, props.onTransferred);
  const { showConfirm } = useDialogs();
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);

  const onLock = useCallback(() => {
    showConfirm({
      title: "Lock Ownable",
      message: <span>Are you sure you want to lock this <em>{pkg?.title}</em>?</span>,
      ok: "Lock",
      onConfirm: () => execute({ lock: {} }),
    });
  }, [pkg, execute, showConfirm]);

  const onUnlock = useCallback(() => {
    execute({ unlock: {} });
  }, [execute]);

  const onCloseOwnable = useCallback(() => {
    showConfirm({
      title: "Close ownable",
      message: <span>No more files can be added after closing <em>{pkg?.title}</em>.</span>,
      ok: "Confirm close",
      onConfirm: () => execute({ close: {} }),
    });
  }, [pkg, execute, showConfirm]);

  const onAddFiles = useCallback(() => {
    attachmentInputRef.current?.click();
  }, []);

  const onFilesSelected = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      event.target.value = "";

      if (files.length === 0) {
        return;
      }

      try {
        setAttachmentError(null);
        const next = await Promise.all(
          files.map(async (file) => ({
            cid: await calculateFileCid(file),
            displayName: file.name,
            originalName: file.name,
            file,
          }))
        );
        setPendingAttachments(next);
      } catch (error) {
        props.onError(
          "Failed to prepare attachments",
          error instanceof Error ? error.message : String(error)
        );
      }
    },
    [props]
  );

  const closeAttachmentDialog = useCallback(() => {
    if (isSubmittingAttachments) return;
    setPendingAttachments([]);
    setAttachmentError(null);
  }, [isSubmittingAttachments]);

  const updateAttachmentName = useCallback((cid: string, value: string) => {
    setPendingAttachments((current) =>
      current.map((attachment) =>
        attachment.cid === cid ? { ...attachment, displayName: value } : attachment
      )
    );
  }, []);

  const submitAttachments = useCallback(async () => {
    if (!packages || pendingAttachments.length === 0) return;

    const invalid = pendingAttachments.find(
      (attachment) => attachment.displayName.trim() === ""
    );
    if (invalid) {
      setAttachmentError("Each selected file needs a name before submission.");
      return;
    }

    try {
      setAttachmentError(null);
      const attachmentsToSubmit = pendingAttachments.map((attachment) => ({
        ...attachment,
        displayName: attachment.displayName.trim(),
      }));

      const eventAttachments = await Promise.all(
        attachmentsToSubmit.map(async ({ cid, file }) => ({
          name: cid,
          file: new File([await file.arrayBuffer()], cid, {
            type: file.type || "application/octet-stream",
          }),
        }))
      );

      // Close the review modal immediately after submission so long-running
      // execute/anchor work does not keep the user stuck in the dialog.
      setPendingAttachments([]);
      setIsSubmittingAttachments(true);

      await execute(
        {
          attach: {
            attachments: attachmentsToSubmit.map(({ cid, displayName }) => ({
              cid,
              name: displayName,
            })),
          },
        },
        undefined,
        true,
        eventAttachments
      );

      try {
        await Promise.all(
          eventAttachments.map(({ name, file }) => packages.storeAttachment(name, file))
        );
      } catch (error) {
        props.onError(
          "Failed to cache attachments",
          error instanceof Error ? error.message : String(error)
        );
      }
    } catch (error) {
      setPendingAttachments(pendingAttachments);
      setAttachmentError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSubmittingAttachments(false);
    }
  }, [execute, packages, pendingAttachments, props]);

  const onDownloadAttachment = useCallback(
    async (name: string, cid: string) => {
      if (!packages) return;

      try {
        const file = await packages.getAttachment(cid);
        const url = URL.createObjectURL(file);
        const link = document.createElement("a");
        link.href = url;
        link.download = name;
        link.click();
        URL.revokeObjectURL(url);
      } catch (error) {
        props.onError(
          "Attachment unavailable",
          error instanceof Error ? error.message : String(error)
        );
      }
    },
    [packages, props]
  );

  useEffect(() => {
    if (!pkg || !pkg.isDynamic || pkg.hasWidgetState) return;
    void onLoad();
  }, [pkg, onLoad]);

  if (!ownables || !packages || !idb || !eventChains || !pkg) return <></>;

  return (
    <>
      <input
        ref={attachmentInputRef}
        className="hidden"
        name="add-files-input"
        type="file"
        multiple
        onChange={onFilesSelected}
      />

      <OwnableDetail
        chain={chain}
        pkg={pkg}
        info={info}
        metadata={metadata}
        issuer={info?.issuer}
        attachments={attachments}
        isConsumable={pkg.isConsumable}
        isConsumed={isConsumed}
        isClosed={isClosed}
        isLockable={pkg.isLockable}
        isLocked={isLocked}
        isTransferred={isTransferred}
        archived={props.archived}
        isHubAvailable={props.isHubAvailable}
        onArchive={props.onArchive}
        onRestore={props.onRestore}
        iframeRef={iframeRef}
        onBack={props.onBack}
        onLoad={() => onLoad()}
        onAddFiles={onAddFiles}
        onConsume={() => !!info && props.onConsume(info)}
        onDownloadAttachment={onDownloadAttachment}
        onCloseOwnable={onCloseOwnable}
        onDelete={props.onDelete}
        onTransfer={(address) => transfer(address)}
        onLock={onLock}
        onUnlock={onUnlock}
      />

      <OwnableSelectedFilesDialog
        open={pendingAttachments.length > 0}
        pendingAttachments={pendingAttachments}
        attachmentError={attachmentError}
        isSubmittingAttachments={isSubmittingAttachments}
        onClose={closeAttachmentDialog}
        onSubmit={submitAttachments}
        onUpdateAttachmentName={updateAttachmentName}
      />
    </>
  );
}
