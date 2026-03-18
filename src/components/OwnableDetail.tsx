import { ReactNode, RefObject } from "react";
import {
  Box,
  CircularProgress,
  Link,
  Tag,
  Tile,
  Tooltip,
  Typography,
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
import If from "./If";

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
      <Typography
        className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
      >
        About
      </Typography>
      {metadata.description && (
        <Typography className="mb-3 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
          {metadata.description}
        </Typography>
      )}
      <Box className="mb-3 flex items-center gap-2">
        <Tag icon={statusTag.icon} value={statusTag.value} variant={statusTag.variant} />
      </Box>
      {metadata.external_url && (
        <Link
          href={metadata.external_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-3 flex items-center gap-1 text-sm font-medium text-indigo-600 visited:text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:visited:text-indigo-400 dark:hover:text-indigo-300"
        >
          <OpenInNew className="h-4 w-4" />
          <span>Visit external link</span>
        </Link>
      )}
      <button className="flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300">
        <Info className="h-4 w-4" />
        <span>More information</span>
      </button>
    </Box>
  );

  return (
    <>
      <Box className="block md:hidden">
        <Box className="flex items-start gap-3 p-4">
          <Box className="min-w-0 flex-1">
            <Typography className="mb-0.5 text-lg font-bold dark:text-white">
              {metadata.name}
            </Typography>
            {issuer && (
              <Typography className="text-sm text-gray-500 dark:text-gray-400">
                <a
                  href={`https://basescan.org/address/${issuer}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 visited:text-indigo-600 hover:text-indigo-700 hover:underline dark:text-indigo-400 dark:visited:text-indigo-400 dark:hover:text-indigo-300"
                >
                  {shortIssuer}
                </a>
              </Typography>
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

        <Box
          className="relative mx-4 w-auto overflow-hidden rounded-2xl border-2 border-dashed border-gray-300 bg-gradient-to-br from-indigo-50 to-purple-50 dark:border-gray-600 dark:from-indigo-950/20 dark:to-purple-950/20"
          style={{ aspectRatio: "3 / 4" }}
        >
          <OwnableFrame
            id={chain.id}
            packageCid={pkg.cid}
            isDynamic={pkg.isDynamic}
            iframeRef={iframeRef}
            onLoad={onLoad}
          />
          <If condition={!pkg.isDynamic}>
            <Box className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <Box className="px-4 text-center">
                <Tile
                  size="lg"
                  variant="neutral"
                  className="mx-auto mb-4 h-20 w-20 rounded-2xl border-none text-6xl"
                  icon={<ImageNotSupported aria-label="No image" className="mx-auto text-slate-500 dark:text-gray-400" />}
                />
                <Typography className="mb-2 text-xl font-semibold text-slate-900 dark:text-white">
                  {metadata.name}
                </Typography>
                <Typography className="text-sm text-slate-500 dark:text-gray-400">
                  Interactive widget content would display here
                </Typography>
              </Box>
            </Box>
          </If>
          {children}

          <If condition={isApplying}>
            <Overlay>
              <div className="flex h-full w-full items-center justify-center overflow-hidden">
                <div className="w-full text-center">
                  <CircularProgress size={80} />
                </div>
              </div>
            </Overlay>
          </If>

          <If condition={isTransferred}>
            <Tooltip
              title="You're unable to interact with this Ownable, because it has been transferred to a different account."
              followCursor
            >
              <Overlay style={{ backgroundColor: "rgba(255, 255, 255, 0.8)" }}>
                <OverlayBanner>Transferred</OverlayBanner>
              </Overlay>
            </Tooltip>
          </If>
        </Box>

        <If condition={isConsumable && !isTransferred}>
          <Box className="mx-4 mt-4">
            <button
              aria-label="Use Item"
              className="w-full rounded-xl bg-orange-500 px-6 py-3 font-semibold text-white transition-colors hover:bg-orange-600 active:bg-orange-700"
              onClick={onConsume}
            >
              Use Item
            </button>
          </Box>
        </If>

        {(metadata.description || metadata.external_url) && aboutSection}
      </Box>

      <Box className="mx-auto hidden max-w-2xl p-8 md:block">
        <Box className="mb-6 rounded-2xl border border-slate-200 bg-white p-8 dark:border-[#2a2a2a] dark:bg-[#1a1a1a]">
          <Box className="mx-auto mb-6 flex max-w-[500px] items-start gap-4">
            <Box className="min-w-0 flex-1">
              <Typography className="mb-1 text-xl font-bold dark:text-white">
                {metadata.name}
              </Typography>
              {issuer && (
                <Typography className="text-sm text-gray-500 dark:text-gray-400">
                  <a
                  href={`https://basescan.org/address/${issuer}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 visited:text-indigo-600 hover:text-indigo-700 hover:underline dark:text-indigo-400 dark:visited:text-indigo-400 dark:hover:text-indigo-300"
                >
                  {shortIssuer}
                </a>
                </Typography>
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

          <Box
            className="relative mx-auto mb-6 flex w-full max-w-[500px] items-center justify-center overflow-hidden"
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

            <If condition={isApplying}>
              <Overlay>
                <div className="flex h-full w-full items-center justify-center overflow-hidden">
                  <div className="w-full text-center">
                    <CircularProgress size={80} />
                  </div>
                </div>
              </Overlay>
            </If>

            <If condition={isTransferred}>
              <Tooltip
                title="You're unable to interact with this Ownable, because it has been transferred to a different account."
                followCursor
              >
                <Overlay style={{ backgroundColor: "rgba(255, 255, 255, 0.8)" }}>
                  <OverlayBanner>Transferred</OverlayBanner>
                </Overlay>
              </Tooltip>
            </If>
          </Box>

          <If condition={isConsumable && !isTransferred}>
            <button
              aria-label="Use Item"
              className="mx-auto block w-full max-w-[500px] rounded-xl bg-orange-500 px-6 py-4 text-lg font-semibold text-white transition-colors hover:bg-orange-600 active:bg-orange-700"
              onClick={onConsume}
            >
              Use Item
            </button>
          </If>
        </Box>

        {(metadata.description || metadata.external_url) && aboutSection}
      </Box>
    </>
  );
}
