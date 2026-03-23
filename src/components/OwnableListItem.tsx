import { useCallback, useEffect, useState } from "react";
import { Box, Button, Tile } from "@/components/ui";
import { Box as BoxIcon, Zap as BoltOutlined } from "lucide-react";
import { EventChain } from "eqty-core";
import { TypedMetadata } from "@/interfaces/TypedOwnableInfo";
import { cva } from "class-variance-authority";
import { cn } from "@/utils/cn";
import shortId from "../utils/shortId";

const itemCard = cva(
  "flex w-full items-start justify-start rounded-[14px] border p-4 text-left transition-all active:scale-[0.99]",
  {
    variants: {
      selected: {
        true: "border-indigo-500 bg-indigo-50 shadow-md dark:bg-indigo-950/30",
        false: "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm dark:border-[#2a2a2a] dark:bg-[#252525] dark:hover:border-[#333333]",
      },
      consumeIntent: {
        none: "",
        active: "border-amber-400 bg-amber-50 dark:border-amber-600 dark:bg-amber-950/20",
        eligible: "shadow-md",
        ineligible: "cursor-not-allowed opacity-40",
      },
    },
    defaultVariants: {
      selected: false,
      consumeIntent: "none",
    },
  }
);

interface OwnableListItemProps {
  chain: EventChain;
  packageCid: string;
  metadata: TypedMetadata;
  issuer?: string;
  isConsumable: boolean;
  isSelected: boolean;
  consumeIntent?: "none" | "active" | "eligible" | "ineligible";
  onClick: () => void;
}

export default function OwnableListItem(props: OwnableListItemProps) {
  const { packageCid, metadata, issuer, isConsumable, isSelected, consumeIntent = "none", onClick } = props;
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const shortIssuer = issuer ? shortId(issuer, 10, "...") : undefined;

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
    <Button
      type="button"
      onClick={onClick}
      disabled={consumeIntent === "ineligible"}
      className={cn(itemCard({ selected: consumeIntent === "none" && isSelected, consumeIntent }))}
    >
      <div className="flex w-full items-start gap-3">
        {/* Thumbnail */}
        <Tile
          size="lg"
          variant="brand"
          className="flex-shrink-0 overflow-hidden rounded-[14px] border-transparent"
          icon={<BoxIcon aria-label="No image" className="h-8 w-8 text-indigo-400 dark:text-indigo-300" />}
        >
          {thumbnailUrl ? (
            <img src={thumbnailUrl} alt={metadata.name} className="h-full w-full object-cover" />
          ) : null}
        </Tile>

        {/* Name + status tag */}
        <Box className="min-w-0 flex-1">
          <p className="mb-0.5 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
            {metadata.name}
          </p>
          {shortIssuer && (
            <p className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">
              {shortIssuer}
            </p>
          )}
          {isConsumable && (
            <div className="mt-1 flex items-center gap-2 text-xs font-medium text-amber-600 dark:text-amber-400">
              <BoltOutlined className="h-3 w-3" />
              <span>Consumable</span>
            </div>
          )}
        </Box>
      </div>
    </Button>
  );
}
