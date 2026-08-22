import { RefObject } from "react";
import { Box, Button, IconButton, Link } from "@/components/ui";
import {
  ArrowLeft,
  ArrowRightLeft,
  ExternalLink,
  ExternalLink as OpenInNew,
  Info,
  Lock,
  LockOpen,
  Zap,
} from "lucide-react";
import { EventChain } from "eqty-core";
import type { TypedAttachment } from "@/interfaces/TypedAttachment";
import { TypedMetadata, TypedOwnableInfo } from "@/interfaces/TypedOwnableInfo";
import { TypedPackage } from "@/interfaces/TypedPackage";
import OwnableFrame from "./OwnableFrame";
import OwnableActions from "./OwnableActions";
import OwnableAttachmentList from "./OwnableAttachmentList";
import OwnableTags from "./OwnableTags";
import OwnableInfo from "./OwnableInfo";
import { OverlayBanner } from "./OverlayBanner";
import { cva } from "class-variance-authority";
import { cn } from "@/utils/cn";
import { normalizeMetadataBackgroundColor } from "@/utils/metadataBackgroundColor";

const actionPanelClass = "mx-4 mt-4 lg:mx-auto lg:mt-0 lg:max-w-125";
const sectionHeadingClass = "text-caption mb-2 uppercase tracking-wide";

interface OwnableDetailProps {
  chain: EventChain;
  pkg: TypedPackage;
  info?: TypedOwnableInfo;
  metadata: TypedMetadata;
  issuer?: string;
  attachments: TypedAttachment[];
  isConsumable: boolean;
  isConsumed: boolean;
  isClosed: boolean;
  isLockable: boolean;
  isLocked: boolean;
  isTransferred: boolean;
  archived?: boolean;
  isHubAvailable?: boolean;
  iframeRef: RefObject<HTMLIFrameElement | null>;
  onBack: () => void;
  onLoad: () => void;
  onAddFiles: () => void;
  onConsume: () => void;
  onDownloadAttachment: (name: string, cid: string) => void;
  onArchive: () => void;
  onCloseOwnable: () => void;
  onRestore: () => void;
  onDelete: () => void;
  onTransfer: (address: string) => void;
  onLock: () => void;
  onUnlock: () => void;
}

const unlockButton = cva(
  "flex w-full items-center justify-center gap-2 rounded-xl bg-slate-700 px-6 py-3 font-semibold text-white transition-colors hover:bg-slate-800 active:bg-slate-900 dark:bg-slate-600 dark:hover:bg-slate-500 lg:py-4 lg:text-lg"
);

const aboutLink = cva("link-primary flex items-center gap-1 text-sm font-medium");
const issuerLink = cva("font-mono link-primary hover:underline");
const consumeButton = cva(
  "w-full rounded-xl bg-orange-500 px-6 py-3 font-semibold text-white transition-colors hover:bg-orange-600 active:bg-orange-700 lg:py-4 lg:text-lg"
);
const primaryPanelButton = cva(
  "w-full rounded-xl px-6 py-3 font-semibold lg:py-4 lg:text-lg"
);

export default function OwnableDetail(props: OwnableDetailProps) {
  const {
    chain,
    pkg,
    info,
    metadata,
    issuer,
    attachments,
    isConsumable,
    isConsumed,
    isClosed,
    isLockable,
    isLocked,
    isTransferred,
    archived = false,
    isHubAvailable = true,
    iframeRef,
    onBack,
    onLoad,
    onAddFiles,
    onConsume,
    onDownloadAttachment,
    onArchive,
    onCloseOwnable,
    onRestore,
    onDelete,
    onTransfer,
    onLock,
    onUnlock,
  } = props;
  const shortIssuer =
    issuer && issuer.length > 10
      ? `${issuer.slice(0, 6)}...${issuer.slice(-4)}`
      : issuer;
  const ownableBackgroundColor = normalizeMetadataBackgroundColor(
    metadata.background_color
  );
  const showAddFilesAction =
    !archived && !isTransferred && pkg.hasAttachments && !isClosed;

  return (
    <Box className="mx-auto lg:max-w-2xl lg:px-8 lg:pt-5">
      <Box className={cn("lg:mb-6 lg:rounded-2xl lg:border lg:border-slate-200 lg:bg-white lg:p-8 lg:shadow-sm dark:lg:border-[#2a2a2a] dark:lg:bg-[#1a1a1a]")}>
        <Box className={cn("flex items-center gap-3 border-b border-slate-200 p-4 dark:border-[#2a2a2a] lg:mx-auto lg:mb-6 lg:max-w-125 lg:items-start lg:gap-4 lg:border-b-0 lg:p-0")}>
          <IconButton aria-label="Back" onClick={onBack} className="shrink-0 lg:hidden">
            <ArrowLeft className="h-5 w-5" />
          </IconButton>
          <Box className="min-w-0 flex-1">
            <h2 className="text-section-title mb-0.5 text-lg lg:mb-1 lg:text-xl">
              {metadata.name}
            </h2>
            {issuer && (
              <p className="text-meta">
                <Link
                  href={`https://basescan.org/address/${issuer}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(issuerLink())}
                >
                  {shortIssuer}
                  <ExternalLink
                    size={16}
                    className="inline ml-1.5"
                    style={{ verticalAlign: "-2px" }}
                  />
                </Link>
              </p>
            )}
          </Box>
          <OwnableActions
            className="lg:-mr-3"
            archived={archived}
            isTransferable={!archived && pkg.isTransferable && !isTransferred}
            isHubAvailable={isHubAvailable}
            isClosable={!archived && pkg.isClosable}
            isClosed={isClosed}
            isLockable={!archived && isLockable}
            isLocked={isLocked}
            onArchive={onArchive}
            onCloseOwnable={onCloseOwnable}
            onRestore={onRestore}
            onDelete={onDelete}
            onTransfer={onTransfer}
            onLock={onLock}
          />
        </Box>

        {pkg.hasWidgetState ? (
          <Box
            className="relative mx-4 overflow-hidden rounded-2xl lg:mx-auto lg:mb-6 lg:max-w-125"
            style={{
              aspectRatio: "3 / 4",
              ...(ownableBackgroundColor
                ? { backgroundColor: ownableBackgroundColor }
                : {}),
            }}
          >
            <OwnableFrame
              id={chain.id}
              packageCid={pkg.cid}
              isDynamic={pkg.isDynamic}
              iframeRef={iframeRef}
              onLoad={onLoad}
            />
            {isConsumed && <OverlayBanner icon={<Zap />} title="Consumed" />}
            {isTransferred && !isConsumed ? (
              <OverlayBanner icon={<ArrowRightLeft />} title="Transferred" />
            ) : null}
            {isLocked && !isConsumed && !isTransferred ? (
              <OverlayBanner icon={<Lock />} title="Locked" />
            ) : null}
          </Box>
        ) : null}

        {!archived && isConsumable && !isTransferred && !isConsumed ? (
          <Box className={actionPanelClass}>
            <Button
              aria-label="Use Item"
              className={cn(consumeButton())}
              onClick={onConsume}
            >
              Use Item
            </Button>
          </Box>
        ) : null}
        {!archived && isLocked && !isConsumed && !isTransferred ? (
          <Box className={actionPanelClass}>
            <Button
              aria-label="Unlock"
              className={cn(unlockButton())}
              onClick={onUnlock}
            >
              <LockOpen className="h-5 w-5" />
              Unlock
            </Button>
          </Box>
        ) : null}
        {showAddFilesAction ? (
          <Box className={actionPanelClass}>
            <Button
              variant="primary"
              className={cn(primaryPanelButton())}
              onClick={onAddFiles}
            >
              Add files
            </Button>
          </Box>
        ) : null}
      </Box>

      <Box className="px-4 pb-8 lg:px-2 lg:pb-0">
        {pkg.hasAttachments ? (
          <section aria-label="Attached files">
            <h3 className={sectionHeadingClass}>
              Attached files
            </h3>
            <OwnableAttachmentList
              attachments={attachments}
              onDownloadAttachment={onDownloadAttachment}
            />
          </section>
        ) : null}

        <section className={pkg.hasAttachments ? "mt-6" : undefined}>
          <h2 className={sectionHeadingClass}>About</h2>
          {metadata.description ? (
            <p className="text-body mb-3">{metadata.description}</p>
          ) : null}
          <OwnableTags
            className="mb-2"
            display="ghost"
            isDossier={info?.ownable_type === "dossier"}
            isClosable={pkg.isClosable}
            isClosed={isClosed}
            isLockable={isLockable}
            isLocked={isLocked}
            isConsumable={isConsumable}
            isConsumed={isConsumed}
            isTransferred={isTransferred}
          />

          {metadata.external_url ? (
            <Link
              href={metadata.external_url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(aboutLink(), "mb-3")}
            >
              <OpenInNew className="h-4 w-4" />
              <span>Visit external link</span>
            </Link>
          ) : null}
          <OwnableInfo
            chain={chain}
            metadata={metadata}
            className={cn(aboutLink(), "px-0")}
          >
            <Info className="h-4 w-4" />
            <span>More information</span>
          </OwnableInfo>
        </section>
      </Box>
    </Box>
  );
}
