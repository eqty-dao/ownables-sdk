import { RefObject } from "react";
import { Box, Button, IconButton, Link } from "@/components/ui";
import { ArrowLeft, ArrowRightLeft, ExternalLink, ExternalLink as OpenInNew, Info, Lock, LockOpen, Zap } from "lucide-react";
import { EventChain } from "eqty-core";
import { TypedMetadata } from "@/interfaces/TypedOwnableInfo";
import { TypedPackage } from "@/interfaces/TypedPackage";
import OwnableFrame from "./OwnableFrame";
import OwnableActions from "./OwnableActions";
import OwnableTags from "./OwnableTags";
import OwnableInfo from "./OwnableInfo";
import { OverlayBanner } from "./OverlayBanner";
import { cva } from "class-variance-authority";
import { cn } from "@/utils/cn";
import { normalizeMetadataBackgroundColor } from "@/utils/metadataBackgroundColor";

interface OwnableDetailProps {
  chain: EventChain;
  pkg: TypedPackage;
  metadata: TypedMetadata;
  issuer?: string;
  isConsumable: boolean;
  isConsumed: boolean;
  isLockable: boolean;
  isLocked: boolean;
  isTransferred: boolean;
  iframeRef: RefObject<HTMLIFrameElement | null>;
  onBack: () => void;
  onLoad: () => void;
  onConsume: () => void;
  onDelete: () => void;
  onTransfer: (address: string) => void;
  onLock: () => void;
  onUnlock: () => void;
}

const unlockButton = cva(
  "w-full rounded-xl bg-slate-700 px-6 font-semibold text-white transition-colors hover:bg-slate-800 active:bg-slate-900 dark:bg-slate-600 dark:hover:bg-slate-500 py-3 lg:py-4 lg:text-lg flex items-center justify-center gap-2"
);

const aboutLink = cva("link-primary flex items-center gap-1 text-sm font-medium");
const issuerLink = cva("font-mono link-primary hover:underline");
const consumeButton = cva(
  "w-full rounded-xl bg-orange-500 px-6 font-semibold text-white transition-colors hover:bg-orange-600 active:bg-orange-700 py-3 lg:py-4 lg:text-lg"
);

export default function OwnableDetail(props: OwnableDetailProps) {
  const {
    chain,
    pkg,
    metadata,
    issuer,
    isConsumable,
    isConsumed,
    isLockable,
    isLocked,
    isTransferred,
    iframeRef,
    onBack,
    onLoad,
    onConsume,
    onDelete,
    onTransfer,
    onLock,
    onUnlock,
  } = props;
  const shortIssuer =
    issuer && issuer.length > 10
      ? `${issuer.slice(0, 6)}...${issuer.slice(-4)}`
      : issuer;
  const ownableBackgroundColor = normalizeMetadataBackgroundColor(metadata.background_color);

  return (
    <Box className="mx-auto lg:max-w-2xl lg:px-8 lg:pt-5">
      <Box className="lg:mb-6 lg:rounded-2xl lg:border lg:border-slate-200 lg:bg-white lg:p-8 lg:shadow-sm dark:lg:border-[#2a2a2a] dark:lg:bg-[#1a1a1a]">

        {/* Header */}
        <Box className="flex items-center gap-3 border-b border-slate-200 p-4 dark:border-[#2a2a2a] lg:mx-auto lg:mb-6 lg:max-w-125 lg:items-start lg:gap-4 lg:border-b-0 lg:p-0">
          <IconButton aria-label="Back" onClick={onBack} className="shrink-0 lg:hidden">
            <ArrowLeft className="h-5 w-5" />
          </IconButton>
          <Box className="min-w-0 flex-1">
            <h2 className="text-section-title mb-0.5 text-lg lg:mb-1 lg:text-xl">{metadata.name}</h2>
            {issuer && (
              <p className="text-meta">
                <Link
                  href={`https://basescan.org/address/${issuer}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(issuerLink())}
                >
                  {shortIssuer}
                  <ExternalLink size={16} className="inline ml-1.5" style={{ verticalAlign: "-2px" }} />
                </Link>
              </p>
            )}
          </Box>
          <OwnableActions
            className="lg:-mr-3"
            title={pkg.title}
            isConsumable={isConsumable && !isTransferred && !isConsumed}
            isTransferable={pkg.isTransferable && !isTransferred}
            isLockable={isLockable}
            isLocked={isLocked}
            onDelete={onDelete}
            chain={chain}
            onConsume={onConsume}
            onTransfer={onTransfer}
            onLock={onLock}
          />
        </Box>

        {/* Widget — single iframe, responsive sizing */}
        <Box
          className="relative mx-4 overflow-hidden rounded-2xl lg:mx-auto lg:mb-6 lg:max-w-125"
          style={{
            aspectRatio: "3 / 4",
            ...(ownableBackgroundColor ? { backgroundColor: ownableBackgroundColor } : {}),
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
          {isTransferred && !isConsumed && <OverlayBanner icon={<ArrowRightLeft />} title="Transferred" />}
          {isLocked && !isConsumed && !isTransferred && <OverlayBanner icon={<Lock />} title="Locked" />}
        </Box>

        {isConsumable && !isTransferred && !isConsumed && (
          <Box className="mx-4 mt-4 lg:mx-auto lg:mt-0 lg:max-w-125">
            <Button
              aria-label="Use Item"
              className={cn(consumeButton())}
              onClick={onConsume}
            >
              Use Item
            </Button>
          </Box>
        )}
        {isLocked && !isConsumed && !isTransferred && (
          <Box className="mx-4 mt-4 lg:mx-auto lg:mt-0 lg:max-w-125">
            <Button
              aria-label="Unlock"
              className={cn(unlockButton())}
              onClick={onUnlock}
            >
              <LockOpen className="h-5 w-5" />
              Unlock
            </Button>
          </Box>
        )}
      </Box>

      <Box className="px-4 pb-8 lg:px-2 lg:pb-0">
        <h2 className="text-caption mb-2 uppercase tracking-wide">About</h2>
        {metadata.description && (
          <p className="text-body mb-3">{metadata.description}</p>
        )}
        <OwnableTags className="mb-2" display="ghost" isLockable={isLockable} isLocked={isLocked} isConsumable={isConsumable} isConsumed={isConsumed} isTransferred={isTransferred} />

        {metadata.external_url && (
          <Link
            href={metadata.external_url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(aboutLink(), "mb-3")}
          >
            <OpenInNew className="h-4 w-4" />
            <span>Visit external link</span>
          </Link>
        )}
        <OwnableInfo chain={chain} metadata={metadata} className={cn(aboutLink(), "px-0")}>
          <Info className="h-4 w-4" />
          <span>More information</span>
        </OwnableInfo>
      </Box>
    </Box>
  );
}
