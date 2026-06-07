import { useCallback, useEffect, useState } from "react";
import { Box, Button, Tag, Tile } from "@/components/ui";
import { Box as BoxIcon } from "lucide-react";
import OwnableTags from "@/components/OwnableTags";
import { EventChain } from "eqty-core";
import { TypedMetadata } from "@/interfaces/TypedOwnableInfo";
import { cva } from "class-variance-authority";
import { cn } from "@/utils/cn";
import shortId from "@/utils/shortId";

const itemCard = cva(
  "flex w-full items-start justify-start rounded-[14px] border p-4 text-left transition-all active:scale-[0.99]",
  {
    variants: {
      kind: {
        imported: "",
        available:
          "border-sky-200 bg-sky-50/80 hover:border-sky-300 hover:bg-sky-100/70 dark:border-sky-900/50 dark:bg-sky-950/20 dark:hover:border-sky-800",
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
  onImport: () => void;
  onDismiss: () => void;
}

type OwnableListItemProps =
  | ImportedOwnableListItemProps
  | AvailableOwnableListItemProps;

export default function OwnableListItem(props: OwnableListItemProps) {
  const importedPackageCid = props.kind === "imported" ? props.packageCid : null;
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const shortIssuer = props.issuer ? shortId(props.issuer, 10, "...") : undefined;

  const loadThumbnail = useCallback(async () => {
    if (!importedPackageCid) {
      setThumbnailUrl(props.kind === "available" ? props.thumbnailUrl ?? null : null);
      return;
    }

    try {
      const globalIdb = await import(
        "@ownables/platform-browser/dist/platform-browser/src/index.js"
      ).then((m) => m.IDBService.main());
      const thumbnailFile = await globalIdb.get(
        `package:${importedPackageCid}`,
        "thumbnail.webp"
      );
      if (thumbnailFile) {
        setThumbnailUrl(URL.createObjectURL(thumbnailFile));
      }
    } catch {
      // No thumbnail available
    }
  }, [importedPackageCid, props]);

  useEffect(() => {
    loadThumbnail();
    return () => {
      if (thumbnailUrl) URL.revokeObjectURL(thumbnailUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadThumbnail]);

  if (props.kind === "available") {
    return (
      <Box className={cn(itemCard({ kind: "available" }))}>
        <div className="flex w-full items-start gap-3">
          <Tile
            size="lg"
            variant="brand"
            className="flex-shrink-0 overflow-hidden rounded-[14px] border-transparent"
            icon={<BoxIcon aria-label="No image" className="h-8 w-8 text-sky-400 dark:text-sky-300" />}
          >
            {thumbnailUrl ? (
              <img src={thumbnailUrl} alt={props.title} className="h-full w-full object-cover" />
            ) : null}
          </Tile>

          <Box className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                {props.title}
              </p>
              <Tag color="info" value="Available on Hub" />
            </div>

            {shortIssuer ? (
              <p className="mt-0.5 truncate text-xs font-medium text-slate-500 dark:text-slate-400">
                {shortIssuer}
              </p>
            ) : null}

            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {props.description || "Transferred to this wallet from Hub."}
            </p>

            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Available {formatAvailableAt(props.availableAt)}
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="small" onClick={props.onImport}>
                Download &amp; import
              </Button>
              <Button size="small" variant="ghost" onClick={props.onDismiss}>
                Dismiss
              </Button>
            </div>
          </Box>
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

function formatAvailableAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}
