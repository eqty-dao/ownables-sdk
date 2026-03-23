import { ReactNode, RefObject } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Link,
  Tag,
} from "@/components/ui";
import {
  ExternalLink as OpenInNew,
  Info,
  Lock,
  LockOpen,
  PackageCheck,
  Zap,
} from "lucide-react";
import { EventChain } from "eqty-core";
import { TypedMetadata } from "@/interfaces/TypedOwnableInfo";
import { TypedPackage } from "@/interfaces/TypedPackage";
import OwnableFrame from "./OwnableFrame";
import OwnableActions from "./OwnableActions";
import Overlay, { OverlayBanner } from "./Overlay";
import { cva } from "class-variance-authority";
import { cn } from "@/utils/cn";

interface OwnableDetailProps {
  chain: EventChain;
  pkg: TypedPackage;
  metadata: TypedMetadata;
  issuer?: string;
  isConsumable: boolean;
  isConsumed: boolean;
  isTransferred: boolean;
  iframeRef: RefObject<HTMLIFrameElement | null>;
  isApplying: boolean;
  onLoad: () => void;
  onConsume: () => void;
  onDelete: () => void;
  onTransfer: (address: string) => void;
  children?: ReactNode;
}

const aboutLink = cva("link-primary flex items-center gap-1 text-sm font-medium");
const issuerLink = cva("font-mono link-primary hover:underline");
const overlayCenter = cva("flex h-full w-full items-center justify-center overflow-hidden");
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
    isTransferred,
    iframeRef,
    isApplying,
    onLoad,
    onConsume,
    onDelete,
    onTransfer,
    children,
  } = props;
  const shortIssuer =
    issuer && issuer.length > 10
      ? `${issuer.slice(0, 6)}...${issuer.slice(-4)}`
      : issuer;
  const statusTag = isTransferred
    ? { value: "Locked", variant: "locked" as const, icon: <Lock className="h-3 w-3" /> }
    : isConsumed
      ? { value: "Consumed", variant: "consumed" as const, icon: <PackageCheck className="h-3 w-3" /> }
      : isConsumable
        ? { value: "Consumable", variant: "consumable" as const, icon: <Zap className="h-3 w-3" /> }
        : { value: "Unlocked", variant: "unlocked" as const, icon: <LockOpen className="h-3 w-3" /> };

  const aboutSection = (
    <Box className="px-4 pb-8 lg:px-2 lg:pb-0">
      <h2 className="text-caption mb-2 uppercase tracking-wide">About</h2>
      {metadata.description && (
        <p className="text-body mb-3">{metadata.description}</p>
      )}
      <Box className="mb-3 flex items-center gap-2">
        <Tag icon={statusTag.icon} value={statusTag.value} variant={statusTag.variant} />
      </Box>
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
      <Button className={cn(aboutLink())}>
        <Info className="h-4 w-4" />
        <span>More information</span>
      </Button>
    </Box>
  );

  return (
    <Box className="mx-auto lg:max-w-2xl lg:px-8 lg:pt-8">
      <Box className="lg:surface-card lg:mb-6 lg:p-8">

        {/* Header */}
        <Box className="flex items-start gap-3 p-4 lg:mx-auto lg:mb-6 lg:max-w-[500px] lg:gap-4 lg:p-0">
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
                </Link>
              </p>
            )}
          </Box>
          <OwnableActions
            title={pkg.title}
            isConsumable={isConsumable && !isTransferred}
            isTransferable={pkg.isTransferable && !isTransferred}
            onDelete={onDelete}
            chain={chain}
            onConsume={onConsume}
            onTransfer={onTransfer}
          />
        </Box>

        {/* Widget — single iframe, responsive sizing */}
        <Box
          className="relative mx-4 overflow-hidden rounded-2xl lg:mx-auto lg:mb-6 lg:max-w-[500px]"
          style={{ aspectRatio: "3 / 4" }}
        >
          <OwnableFrame
            id={chain.id}
            packageCid={pkg.cid}
            isDynamic={pkg.isDynamic}
            iframeRef={iframeRef}
            onLoad={onLoad}
          />
          {children}
          {isApplying && (
            <Overlay>
              <div className={cn(overlayCenter())}>
                <div className="w-full text-center"><CircularProgress /></div>
              </div>
            </Overlay>
          )}
          {isTransferred && (
            <Overlay
              className="bg-white/80 dark:bg-slate-900/70"
              title="You're unable to interact with this Ownable, because it has been transferred to a different account."
            >
              <OverlayBanner>Transferred</OverlayBanner>
            </Overlay>
          )}
        </Box>

        {isConsumable && !isTransferred && (
          <Box className="mx-4 mt-4 lg:mx-auto lg:mt-0 lg:max-w-[500px]">
            <Button
              aria-label="Use Item"
              className={cn(consumeButton())}
              onClick={onConsume}
            >
              Use Item
            </Button>
          </Box>
        )}
      </Box>

      {(metadata.description || metadata.external_url) && aboutSection}
    </Box>
  );
}
