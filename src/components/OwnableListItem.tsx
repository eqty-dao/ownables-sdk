import { useCallback, useEffect, useState } from "react";
import { Box } from "@/components/ui/primitives";
import { Zap as BoltOutlined, ImageOff as ImageNotSupported } from "lucide-react";
import { EventChain } from "eqty-core";
import { TypedMetadata } from "../interfaces/TypedOwnableInfo";
import { cva } from "class-variance-authority";
import { cn } from "./ui/lib/cn";

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
        <Box
          className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100"
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

        {/* Name + consumable chip */}
        <Box className="min-w-0 flex-1">
          <Box className="mb-0.5 truncate text-sm font-semibold text-slate-900">
            {metadata.name}
          </Box>
          {isConsumable && (
            <Box className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
              <BoltOutlined className="h-3.5 w-3.5" />
              Consumable
            </Box>
          )}
        </Box>
      </div>
    </button>
  );
}
