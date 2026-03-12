import { useCallback, useEffect, useState } from "react";
import { Box, ButtonBase, Chip, Paper } from "@mui/material";
import { BoltOutlined, ImageNotSupported } from "@mui/icons-material";
import { EventChain } from "eqty-core";
import { TypedMetadata } from "../interfaces/TypedOwnableInfo";

interface OwnableListItemProps {
  chain: EventChain;
  packageCid: string;
  metadata: TypedMetadata;
  isConsumable: boolean;
  isSelected: boolean;
  onClick: () => void;
}

export default function OwnableListItem(props: OwnableListItemProps) {
  const { packageCid, metadata, isConsumable, isSelected, onClick } = props;
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

  const loadThumbnail = useCallback(async () => {
    try {
      const globalIdb = await import("../services/IDB.service").then((m) =>
        m.default.main()
      );
      const thumbnailFile = await globalIdb.get(
        `package:${packageCid}`,
        "thumbnail.webp"
      );
      if (thumbnailFile) {
        setThumbnailUrl(URL.createObjectURL(thumbnailFile));
      }
    } catch {
      // No thumbnail available
    }
  }, [packageCid]);

  useEffect(() => {
    loadThumbnail();
    return () => {
      if (thumbnailUrl) URL.revokeObjectURL(thumbnailUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadThumbnail]);

  return (
    <ButtonBase
      onClick={onClick}
      sx={{ display: "block", width: "100%", textAlign: "left" }}
    >
      <Paper
        elevation={isSelected ? 3 : 0}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          px: 2,
          py: 1.5,
          borderRadius: 2,
          border: isSelected ? "2px solid" : "2px solid transparent",
          borderColor: isSelected ? "primary.main" : "transparent",
          "&:hover": { backgroundColor: "action.hover" },
        }}
      >
        {/* Thumbnail */}
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: 1,
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
              sx={{ color: "grey.400", fontSize: 24 }}
            />
          )}
        </Box>

        {/* Name + consumable chip */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box
            sx={{
              fontWeight: 500,
              fontSize: "0.9rem",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {metadata.name}
          </Box>
          {isConsumable && (
            <Chip
              icon={<BoltOutlined sx={{ fontSize: "14px !important" }} />}
              label="Consumable"
              size="small"
              sx={{ mt: 0.5, height: 20, fontSize: "0.7rem" }}
            />
          )}
        </Box>
      </Paper>
    </ButtonBase>
  );
}
