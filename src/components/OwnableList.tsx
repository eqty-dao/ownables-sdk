import { useState } from "react";
import { Box, IconButton, Tile } from "@/components/ui";
import { EventChain } from "eqty-core";
import { TypedOwnableInfo } from "@/interfaces/TypedOwnableInfo";
import { useService } from "@/hooks/useService";
import { cva } from "class-variance-authority";
import { cn } from "@/utils/cn";
import OwnableListItem from "./OwnableListItem";
import IssueOwnableButton from "./IssueOwnableButton";
import { AvailableOwnableEntry, MainListEntry } from "@/hooks/useOwnables";
import { Box as BoxIcon, ChevronDown, ChevronRight, RotateCcw } from "lucide-react";
import shortId from "@/utils/shortId";

const listPane = cva("w-full flex-shrink-0 px-4 lg:w-[384px]", {
  variants: {
    hiddenOnMobile: {
      true: "hidden lg:block",
      false: "block",
    },
    elevated: {
      true: "relative z-[200]",
      false: "",
    },
  },
  defaultVariants: { hiddenOnMobile: false, elevated: false },
});

interface ConsumingState {
  chain: EventChain;
  package: string;
  info: TypedOwnableInfo;
}

interface OwnableListProps {
  entries: MainListEntry[];
  selectedChainId: string | null;
  className?: string;
  issueSelected: boolean;
  hiddenOnMobile: boolean;
  consuming: ConsumingState | null;
  consumeEligibility: Record<string, boolean>;
  archivedAvailableOwnables: AvailableOwnableEntry[];
  hiddenAvailableOwnablesCount: number;
  onSelect: (chainId: string) => void;
  onConsume: (consumer: EventChain, consumable: EventChain) => void;
  onIssue: () => void;
  onImportAvailable: (entryId: string) => void | Promise<void>;
  onRestoreAvailable: (entryId: string) => void;
}

export default function OwnableList({
  entries,
  selectedChainId,
  className,
  issueSelected,
  hiddenOnMobile,
  consuming,
  consumeEligibility,
  archivedAvailableOwnables,
  hiddenAvailableOwnablesCount,
  onSelect,
  onConsume,
  onIssue,
  onImportAvailable,
  onRestoreAvailable,
}: OwnableListProps) {
  const packageService = useService("packages");
  const [showArchived, setShowArchived] = useState(false);

  return (
    <Box aria-label="Ownable list" role="navigation" className={cn(listPane({ hiddenOnMobile, elevated: consuming !== null }), className)}>
      <Box className="space-y-4">
        <Box className="space-y-2">
          {entries.map((entry) => {
            if (entry.kind === "available") {
              return (
                <OwnableListItem
                  key={entry.id}
                  kind="available"
                  id={entry.id}
                  title={entry.title}
                  description={entry.description}
                  issuer={entry.issuer}
                  availableAt={entry.availableAt}
                  thumbnailUrl={entry.package.thumbnailUrl}
                  isSelected={selectedChainId === entry.id}
                  onClick={() => onSelect(entry.id)}
                  onImport={() => {
                    void onImportAvailable(entry.id);
                  }}
                />
              );
            }

            const { chain, package: packageCid, uniqueMessageHash, isConsumed, isLocked, isTransferred } = entry;
            const pkg = packageService?.info(packageCid, uniqueMessageHash);
            return (
              <OwnableListItem
                key={chain.id}
                kind="imported"
                chain={chain}
                packageCid={packageCid}
                metadata={{ name: pkg?.title ?? "", description: pkg?.description }}
                issuer={chain.events[0]?.signerAddress}
                isConsumable={!!(pkg?.isConsumable)}
                isConsumed={!!isConsumed}
                isLockable={!!(pkg?.isLockable)}
                isLocked={!!isLocked}
                isTransferred={!!isTransferred}
                isSelected={selectedChainId === chain.id}
                consumeIntent={
                  consuming === null ? "none"
                  : chain.id === consuming.chain.id ? "active"
                  : !consumeEligibility[chain.id] ? "ineligible"
                  : consumeEligibility[chain.id] ? "eligible"
                  : "none"
                }
                onClick={() => {
                  if (consuming !== null) {
                    if (chain.id !== consuming.chain.id) onConsume(chain, consuming.chain);
                    return;
                  }
                  onSelect(chain.id);
                }}
              />
            );
          })}
        </Box>

      </Box>

      <IssueOwnableButton
        selected={issueSelected}
        disabled={consuming !== null}
        onClick={() => { if (consuming !== null) return; onIssue(); }}
      />

      {hiddenAvailableOwnablesCount > 0 ? (
        <Box className="mt-3 rounded-[16px] border border-slate-200 bg-white p-3 dark:border-[#2a2a2a] dark:bg-[#252525]">
          <button
            type="button"
            className="flex w-full items-center justify-between text-left"
            onClick={() => setShowArchived((current) => !current)}
          >
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">Archived</span>
            <span className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              {hiddenAvailableOwnablesCount}
              {showArchived ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </span>
          </button>

          {showArchived ? (
            <Box className="mt-3 space-y-2">
              {archivedAvailableOwnables.map((entry) => (
                <Box
                  key={entry.id}
                  className="flex items-start gap-3 rounded-[14px] border border-slate-200 bg-white p-4 dark:border-[#2a2a2a] dark:bg-[#252525]"
                >
                  <Tile
                    size="lg"
                    variant="brand"
                    className="flex-shrink-0 overflow-hidden rounded-[14px] border-transparent"
                    icon={<BoxIcon aria-label="No image" className="h-8 w-8 text-indigo-400 dark:text-indigo-300" />}
                  >
                    {entry.package.thumbnailUrl ? (
                      <img src={entry.package.thumbnailUrl} alt={entry.title} className="h-full w-full object-cover" />
                    ) : null}
                  </Tile>

                  <Box className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {entry.title}
                    </p>
                    {entry.issuer ? (
                      <p className="mt-0.5 truncate text-xs font-medium text-slate-500 dark:text-slate-400">
                        {shortId(entry.issuer, 10, "...")}
                      </p>
                    ) : null}
                  </Box>

                  <IconButton
                    aria-label={`Restore ${entry.title}`}
                    variant="ghost"
                    onClick={() => onRestoreAvailable(entry.id)}
                  >
                    <RotateCcw className="h-4 w-4" />
                  </IconButton>
                </Box>
              ))}
            </Box>
          ) : null}
        </Box>
      ) : null}
    </Box>
  );
}
