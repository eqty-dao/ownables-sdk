import { ReactNode, RefObject } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Link,
  Tag,
  Tile,
  Tooltip,
} from "@/components/ui";
import {
  ExternalLink as OpenInNew,
  ImageOff as ImageNotSupported,
  Info,
  Lock,
  LockOpen,
  Zap,
} from "lucide-react";
import { EventChain } from "eqty-core";
import { TypedMetadata } from "../interfaces/TypedOwnableInfo";
import { TypedPackage } from "../interfaces/TypedPackage";
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
  isTransferred: boolean;
  iframeRef: RefObject<HTMLIFrameElement>;
  isApplying: boolean;
  onLoad: () => void;
  onConsume: () => void;
  onDelete: () => void;
  onTransfer: (address: string) => void;
  children?: ReactNode;
}

const aboutLink = cva("link-primary flex items-center gap-1 text-sm font-medium");
const issuerLink = cva("link-primary hover:underline");
const widgetShell = cva("relative overflow-hidden rounded-2xl", {
  variants: {
    layout: {
      mobile: "mx-4 w-auto",
      desktop: "mx-auto mb-6 flex w-full max-w-[500px] items-center justify-center",
    },
  },
});
const consumeButton = cva(
  "w-full rounded-xl bg-orange-500 px-6 font-semibold text-white transition-colors hover:bg-orange-600 active:bg-orange-700",
  {
    variants: {
      size: {
        mobile: "py-3",
        desktop: "mx-auto block max-w-[500px] py-4 text-lg",
      },
    },
  }
);
const overlayCenter = cva("flex h-full w-full items-center justify-center overflow-hidden");

export default function OwnableDetail(props: OwnableDetailProps) {
  const {
    chain,
    pkg,
    metadata,
    issuer,
    isConsumable,
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
    : isConsumable
      ? { value: "Consumable", variant: "consumable" as const, icon: <Zap className="h-3 w-3" /> }
      : { value: "Unlocked", variant: "unlocked" as const, icon: <LockOpen className="h-3 w-3" /> };

  const aboutSection = (
    <Box className="px-4 pb-8 md:px-2 md:pb-0">
      <h2 className="text-caption mb-2 uppercase tracking-wide">
        About
      </h2>
      {metadata.description && (
        <p className="text-body mb-3">
          {metadata.description}
        </p>
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
    <>
      <Box className="block md:hidden">
        <Box className="flex items-start gap-3 p-4">
          <Box className="min-w-0 flex-1">
            <h2 className="text-section-title mb-0.5 text-lg">
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

        <Box className={cn(widgetShell({ layout: "mobile" }))} style={{ aspectRatio: "3 / 4" }}>
          <OwnableFrame
            id={chain.id}
            packageCid={pkg.cid}
            isDynamic={pkg.isDynamic}
            iframeRef={iframeRef}
            onLoad={onLoad}
          />
          {!pkg.isDynamic && (
            <Box className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <Box className="px-4 text-center">
                <Tile
                  size="lg"
                  variant="neutral"
                  className="mx-auto mb-4 h-20 w-20 rounded-2xl border-none text-6xl"
                  icon={<ImageNotSupported aria-label="No image" className="mx-auto text-slate-500 dark:text-gray-400" />}
                />
                <h3 className="text-section-title mb-2 text-xl font-semibold">
                  {metadata.name}
                </h3>
                <p className="text-meta">
                  Interactive widget content would display here
                </p>
              </Box>
            </Box>
          )}
          {children}

          {isApplying && (
            <Overlay>
              <div className={cn(overlayCenter())}>
                <div className="w-full text-center">
                  <CircularProgress size={80} />
                </div>
              </div>
            </Overlay>
          )}

          {isTransferred && (
            <Tooltip
              title="You're unable to interact with this Ownable, because it has been transferred to a different account."
              followCursor
            >
              <Overlay className="bg-white/80 dark:bg-slate-900/70">
                <OverlayBanner>Transferred</OverlayBanner>
              </Overlay>
            </Tooltip>
          )}
        </Box>

        {isConsumable && !isTransferred && (
          <Box className="mx-4 mt-4">
            <Button
              aria-label="Use Item"
              className={cn(consumeButton({ size: "mobile" }))}
              onClick={onConsume}
            >
              Use Item
            </Button>
          </Box>
        )}

        {(metadata.description || metadata.external_url) && aboutSection}
      </Box>

      <Box className="mx-auto hidden max-w-2xl p-8 md:block">
        <Box className="surface-card mb-6 p-8">
          <Box className="mx-auto mb-6 flex max-w-[500px] items-start gap-4">
            <Box className="min-w-0 flex-1">
              <h2 className="text-section-title mb-1">
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

          <Box className={cn(widgetShell({ layout: "desktop" }))} style={{ aspectRatio: "3 / 4" }}>
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
                  <div className="w-full text-center">
                    <CircularProgress size={80} />
                  </div>
                </div>
              </Overlay>
            )}

            {isTransferred && (
              <Tooltip
                title="You're unable to interact with this Ownable, because it has been transferred to a different account."
                followCursor
              >
                <Overlay className="bg-white/80 dark:bg-slate-900/70">
                  <OverlayBanner>Transferred</OverlayBanner>
                </Overlay>
              </Tooltip>
            )}
          </Box>

          {isConsumable && !isTransferred && (
            <Button
              aria-label="Use Item"
              className={cn(consumeButton({ size: "desktop" }))}
              onClick={onConsume}
            >
              Use Item
            </Button>
          )}
        </Box>

        {(metadata.description || metadata.external_url) && aboutSection}
      </Box>
    </>
  );
}
