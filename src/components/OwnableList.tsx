import { useState } from "react";
import { Box } from "@/components/ui";
import { EventChain } from "eqty-core";
import { TypedOwnableInfo } from "@/interfaces/TypedOwnableInfo";
import { useService } from "@/hooks/useService";
import { cva } from "class-variance-authority";
import { cn } from "@/utils/cn";
import OwnableListItem from "./OwnableListItem";
import IssueOwnableButton from "./IssueOwnableButton";
import { ArchivedListEntry, MainListEntry } from "@/hooks/useOwnables";
import { ChevronDown, ChevronRight } from "lucide-react";

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
  archivedEntries: ArchivedListEntry[];
  archivedOwnablesCount: number;
  onSelect: (chainId: string) => void;
  onConsume: (consumer: EventChain, consumable: EventChain) => void;
  onIssue: () => void;
  onImportAvailable: (entryId: string) => void | Promise<void>;
}

export default function OwnableList({
  entries,
  selectedChainId,
  className,
  issueSelected,
  hiddenOnMobile,
  consuming,
  consumeEligibility,
  archivedEntries,
  archivedOwnablesCount,
  onSelect,
  onConsume,
  onIssue,
  onImportAvailable,
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

      {archivedOwnablesCount > 0 ? (
        <Box className="mt-3">
          <button
            type="button"
            className="flex w-full items-center justify-between px-1 text-left"
            onClick={() => setShowArchived((current) => !current)}
          >
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">Archived</span>
            <span className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              {archivedOwnablesCount}
              {showArchived ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </span>
          </button>

          {showArchived ? (
            <Box className="mt-3 space-y-2">
              {archivedEntries.map((entry) =>
                entry.kind === "available" ? (
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
                    showImportAction={false}
                    onClick={() => onSelect(entry.id)}
                    onImport={() => {}}
                  />
                ) : (
                  <OwnableListItem
                    key={entry.chain.id}
                    kind="imported"
                    chain={entry.chain}
                    packageCid={entry.package}
                    metadata={{
                      name: packageService?.info(entry.package, entry.uniqueMessageHash)?.title ?? "",
                      description: packageService?.info(entry.package, entry.uniqueMessageHash)?.description,
                    }}
                    issuer={entry.chain.events[0]?.signerAddress}
                    isConsumable={!!packageService?.info(entry.package, entry.uniqueMessageHash)?.isConsumable}
                    isConsumed={!!entry.isConsumed}
                    isLockable={!!packageService?.info(entry.package, entry.uniqueMessageHash)?.isLockable}
                    isLocked={!!entry.isLocked}
                    isTransferred={!!entry.isTransferred}
                    isSelected={selectedChainId === entry.chain.id}
                    onClick={() => onSelect(entry.chain.id)}
                  />
                )
              )}
            </Box>
          ) : null}
        </Box>
      ) : null}
    </Box>
  );
}
