import { useCallback, useEffect, useState } from "react";
import { Box, Tag, Tile } from "@/components/ui";
import { Zap as BoltOutlined, ImageOff as ImageNotSupported } from "lucide-react";
import { EventChain } from "eqty-core";
import { TypedMetadata } from "../interfaces/TypedOwnableInfo";
import { cva } from "class-variance-authority";
import { cn } from "../utils/cn";

const itemCard = cva(
  "w-full rounded-xl border p-4 text-left transition-all active:scale-[0.99]",
  {
    variants: {
      selected: {
        true: "border-indigo-500 bg-indigo-50 shadow-md",
        false: "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm",
      },
    },
    defaultVariants: {
      selected: false,
    },
  }
);

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
    <button
      type="button"
      onClick={onClick}
      className={cn(itemCard({ selected: isSelected }))}
    >
      <div className="flex items-start gap-3">
        {/* Thumbnail */}
        <Tile
          size="lg"
          variant="brand"
          className="flex-shrink-0 overflow-hidden"
          icon={<ImageNotSupported aria-label="No image" className="text-slate-400" />}
        >
          {thumbnailUrl ? (
            <img src={thumbnailUrl} alt={metadata.name} className="h-full w-full object-cover" />
          ) : null}
        </Tile>

        {/* Name + consumable chip */}
        <Box className="min-w-0 flex-1">
          <Box className="mb-0.5 truncate text-sm font-semibold text-slate-900">
            {metadata.name}
          </Box>
          {isConsumable && (
            <Tag icon={<BoltOutlined className="h-3.5 w-3.5" />} value="Consumable" variant="consumable" />
          )}
        </Box>
      </div>
    </button>
  );
}
