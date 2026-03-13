import { ReactNode, RefObject, useCallback, useEffect, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Grid,
  Link,
  Tooltip,
  Typography,
} from "@ui/mui";
import { BoltOutlined, ImageNotSupported, OpenInNew } from "@ui/icons";
import { EventChain } from "eqty-core";
import { TypedMetadata } from "../interfaces/TypedOwnableInfo";
import { TypedPackage } from "../interfaces/TypedPackage";
import OwnableFrame from "./OwnableFrame";
import OwnableActions from "./OwnableActions";
import OwnableInfo from "./OwnableInfo";
import Overlay, { OverlayBanner } from "./Overlay";
import If from "./If";

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
    <Box>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
        {/* Thumbnail */}
        <Box
          sx={{
            width: 56,
            height: 56,
            borderRadius: 1.5,
            flexShrink: 0,
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "grey.100",
          }}
        >
          {thumbnailUrl ? (
            <Box
              component="img"
              src={thumbnailUrl}
              alt={metadata.name}
              sx={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <ImageNotSupported
              aria-label="No image"
              sx={{ color: "grey.400", fontSize: 28 }}
            />
          )}
        </Box>

        {/* Name + consumable */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h6" component="h2" noWrap>
            {metadata.name}
          </Typography>
          {isConsumable && !isTransferred && (
            <Box
              aria-label="Consumable"
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.5,
                color: "warning.main",
                fontSize: "0.8rem",
                fontWeight: 500,
              }}
            >
              <BoltOutlined sx={{ fontSize: 16 }} />
              Consumable
            </Box>
          )}
        </Box>

        {/* Actions menu + Info */}
        <Box sx={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
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
        sx={{
          position: "relative",
          border: "2px dashed",
          borderColor: "divider",
          borderRadius: 2,
          height: 400,
          overflow: "hidden",
        }}
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
            <Grid
              container
              justifyContent="center"
              alignItems="center"
              height="100%"
              width="100%"
              overflow="hidden"
              padding={0}
              margin={0}
            >
              <Grid width="100%" padding={0} textAlign="center">
                <CircularProgress color="primary" size={80} />
              </Grid>
            </Grid>
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
          variant="contained"
          color="warning"
          fullWidth
          sx={{ mt: 2 }}
          onClick={onConsume}
        >
          Use Item
        </Button>
      </If>

      {/* About section */}
      {(metadata.description || metadata.external_url) && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="overline" color="text.secondary">
            About
          </Typography>
          {metadata.description && (
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              {metadata.description}
            </Typography>
          )}
          {metadata.external_url && (
            <Link
              href={metadata.external_url}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 1, fontSize: "0.875rem" }}
            >
              <OpenInNew sx={{ fontSize: 16 }} />
              Visit website
            </Link>
          )}
        </Box>
      )}
    </Box>
  );
}
