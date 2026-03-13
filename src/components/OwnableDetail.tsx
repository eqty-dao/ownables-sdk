import { ReactNode, RefObject, useCallback, useEffect, useState } from "react";
import {
  Box,
  CircularProgress,
  Link,
  Tooltip,
  Typography,
} from "@/components/ui/primitives";
import { Zap as BoltOutlined, ImageOff as ImageNotSupported, ExternalLink as OpenInNew } from "lucide-react";
import { EventChain } from "eqty-core";
import { TypedMetadata } from "../interfaces/TypedOwnableInfo";
import { TypedPackage } from "../interfaces/TypedPackage";
import OwnableFrame from "./OwnableFrame";
import OwnableActions from "./OwnableActions";
import OwnableInfo from "./OwnableInfo";
import Overlay, { OverlayBanner } from "./Overlay";
import If from "./If";
import { Button } from "./ui/button";

interface OwnableDetailProps {
  chain: EventChain;
  pkg: TypedPackage;
  metadata: TypedMetadata;
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

  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

  const loadThumbnail = useCallback(async () => {
    try {
      const globalIdb = await import("../services/IDB.service").then((m) =>
        m.default.main()
      );
      const thumbnailFile = await globalIdb.get(
        `package:${pkg.cid}`,
        "thumbnail.webp"
      );
      if (thumbnailFile) {
        setThumbnailUrl(URL.createObjectURL(thumbnailFile));
      }
    } catch {
      // No thumbnail available
    }
  }, [pkg.cid]);

  useEffect(() => {
    loadThumbnail();
    return () => {
      if (thumbnailUrl) URL.revokeObjectURL(thumbnailUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadThumbnail]);

  return (
    <Box className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
      {/* Header */}
      <Box className="mb-4 flex items-center gap-3">
        {/* Thumbnail */}
        <Box
          className="flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100"
        >
          {thumbnailUrl ? (
            <Box
              component="img"
              src={thumbnailUrl}
              alt={metadata.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <ImageNotSupported
              aria-label="No image"
              className="text-slate-400"
            />
          )}
        </Box>

        {/* Name + consumable */}
        <Box className="min-w-0 flex-1">
          <Typography component="h2" className="truncate text-3xl font-semibold leading-tight text-slate-900 md:text-5xl">
            {metadata.name}
          </Typography>
          {isConsumable && !isTransferred && (
            <Box
              aria-label="Consumable"
              className="inline-flex items-center gap-1 text-sm font-medium text-amber-600"
            >
              <BoltOutlined className="h-4 w-4" />
              Consumable
            </Box>
          )}
        </Box>

        {/* Actions menu + Info */}
        <Box className="flex flex-shrink-0 items-center">
          <OwnableInfo chain={chain} metadata={metadata} />
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
      </Box>

      {/* Widget area */}
      <Box
        className="relative h-[420px] overflow-hidden rounded-2xl border border-slate-300"
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
                <CircularProgress color="primary" size={80} />
              </div>
            </div>
          </Overlay>
        </If>

        <If condition={isTransferred}>
          <Tooltip
            title="You're unable to interact with this Ownable, because it has been transferred to a different account."
            followCursor
          >
            <Overlay sx={{ backgroundColor: "rgba(255, 255, 255, 0.8)" }}>
              <OverlayBanner>Transferred</OverlayBanner>
            </Overlay>
          </Tooltip>
        </If>
      </Box>

      {/* Use Item button */}
      <If condition={isConsumable && !isTransferred}>
        <Button
          aria-label="Use Item"
          variant="primary"
          className="mt-4 h-11 w-full rounded-xl bg-amber-500 text-sm font-semibold text-white hover:bg-amber-600"
          onClick={onConsume}
        >
          Use Item
        </Button>
      </If>

      {/* About section */}
      {(metadata.description || metadata.external_url) && (
        <Box className="mt-6">
          <Typography className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            About
          </Typography>
          {metadata.description && (
            <Typography className="mt-2 text-sm text-slate-700">
              {metadata.description}
            </Typography>
          )}
          {metadata.external_url && (
            <Link
              href={metadata.external_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700"
            >
              <OpenInNew className="h-4 w-4" />
              Visit website
            </Link>
          )}
        </Box>
      )}
    </Box>
  );
}
