import { useCallback, useEffect, useState } from "react";
import { Box, Button, IconButton, Tile, Tooltip } from "@/components/ui";
import { Box as BoxIcon, Download } from "lucide-react";
import OwnableTags from "@/components/OwnableTags";
import { EventChain } from "eqty-core";
import { TypedMetadata } from "@/interfaces/TypedOwnableInfo";
import { cva } from "class-variance-authority";
import { cn } from "@/utils/cn";
import shortId from "@/utils/shortId";
import { useService } from "@/hooks/useService";

const itemCard = cva(
  "flex w-full items-start justify-start rounded-[14px] border p-4 text-left transition-all active:scale-[0.99]",
  {
    variants: {
      kind: {
        imported: "",
        available:
          "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm dark:border-[#2a2a2a] dark:bg-[#252525] dark:hover:border-[#333333]",
      },
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
      kind: "imported",
      selected: false,
      consumeIntent: "none",
    },
  }
);

interface ImportedOwnableListItemProps {
  kind: "imported";
  chain: EventChain;
  packageCid: string;
  metadata: TypedMetadata;
  issuer?: string;
  isConsumable: boolean;
  isConsumed: boolean;
  isLockable: boolean;
  isLocked: boolean;
  isTransferred: boolean;
  isSelected: boolean;
  consumeIntent?: "none" | "active" | "eligible" | "ineligible";
  onClick: () => void;
}

interface AvailableOwnableListItemProps {
  kind: "available";
  id: string;
  title: string;
  description?: string;
  issuer?: string;
  availableAt: string;
  thumbnailUrl?: string | null;
  isSelected?: boolean;
  showImportAction?: boolean;
  onClick: () => void;
  onImport: () => void;
}

type OwnableListItemProps =
  | ImportedOwnableListItemProps
  | AvailableOwnableListItemProps;

export default function OwnableListItem(props: OwnableListItemProps) {
  const importedPackageCid = props.kind === "imported" ? props.packageCid : null;
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const shortIssuer = props.issuer ? shortId(props.issuer, 10, "...") : undefined;
  const packageService = useService("packages");

  const loadThumbnail = useCallback(async () => {
    if (!importedPackageCid) {
      setThumbnailUrl(props.kind === "available" ? props.thumbnailUrl ?? null : null);
      return;
    }

    if (!packageService) {
      setThumbnailUrl(null);
      return;
    }

    try {
      const dataUri = await packageService.getAssetAsDataUri(
        importedPackageCid,
        "thumbnail.webp"
      );
      setThumbnailUrl(dataUri);
    } catch {
      // No thumbnail available
      setThumbnailUrl(null);
    }
  }, [importedPackageCid, packageService, props]);

  useEffect(() => {
    loadThumbnail();
    return () => {
      if (thumbnailUrl) URL.revokeObjectURL(thumbnailUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadThumbnail]);

  if (props.kind === "available") {
    return (
      <Box
        role="button"
        tabIndex={0}
        className={cn(itemCard({ kind: "available", selected: !!props.isSelected }))}
        onClick={props.onClick}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            props.onClick();
          }
        }}
      >
        <div className="flex w-full items-start gap-3">
          <Tile
            size="lg"
            variant="brand"
            className="flex-shrink-0 overflow-hidden rounded-[14px] border-transparent"
            icon={<BoxIcon aria-label="No image" className="h-8 w-8 text-indigo-400 dark:text-indigo-300" />}
          >
            {thumbnailUrl ? (
              <img src={thumbnailUrl} alt={props.title} className="h-full w-full object-cover" />
            ) : null}
          </Tile>

          <Box className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
              {props.title}
            </p>

            {shortIssuer ? (
              <p className="mt-0.5 truncate text-xs font-medium text-slate-500 dark:text-slate-400">
                {shortIssuer}
              </p>
            ) : null}
          </Box>

          {props.showImportAction !== false ? (
            <div className="ml-2 flex flex-shrink-0 items-center gap-1">
              <Tooltip title="Import">
                <IconButton
                  aria-label={`Import ${props.title}`}
                  variant="ghost"
                  onClick={(event) => {
                    event.stopPropagation();
                    props.onImport();
                  }}
                >
                  <Download className="h-4 w-4" />
                </IconButton>
              </Tooltip>
            </div>
          ) : null}
        </div>
      </Box>
    );
  }

  const {
    metadata,
    isConsumable,
    isConsumed,
    isLockable,
    isLocked,
    isTransferred,
    isSelected,
    consumeIntent = "none",
    onClick,
  } = props;

  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={consumeIntent === "ineligible"}
      className={cn(
        itemCard({
          kind: "imported",
          selected: consumeIntent === "none" && isSelected,
          consumeIntent,
        })
      )}
    >
      <div className="flex w-full items-start gap-3">
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

        <Box className="min-w-0 flex-1">
          <p className="mb-0.5 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
            {metadata.name}
          </p>
          {shortIssuer && (
            <p className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">
              {shortIssuer}
            </p>
          )}
          <div className="mt-1">
            <OwnableTags
              display="ghost"
              isLockable={isLockable}
              isLocked={isLocked}
              isConsumable={isConsumable}
              isConsumed={isConsumed}
              isTransferred={isTransferred}
              showUnlocked={false}
            />
          </div>
        </Box>
      </div>
    </Button>
  );
}
