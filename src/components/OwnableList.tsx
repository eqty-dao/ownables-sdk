import { Box, Button } from "@/components/ui";
import { EventChain } from "eqty-core";
import { TypedOwnableInfo } from "@/interfaces/TypedOwnableInfo";
import { useService } from "@/hooks/useService";
import { cva } from "class-variance-authority";
import { cn } from "@/utils/cn";
import OwnableListItem from "./OwnableListItem";
import IssueOwnableButton from "./IssueOwnableButton";
import { MainListEntry } from "@/hooks/useOwnables";

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
  hiddenAvailableOwnablesCount: number;
  onSelect: (chainId: string) => void;
  onConsume: (consumer: EventChain, consumable: EventChain) => void;
  onIssue: () => void;
  onImportAvailable: (entryId: string) => void | Promise<void>;
  onDismissAvailable: (entryId: string) => void;
  onResetHiddenAvailable: () => void;
}

export default function OwnableList({
  entries,
  selectedChainId,
  className,
  issueSelected,
  hiddenOnMobile,
  consuming,
  consumeEligibility,
  hiddenAvailableOwnablesCount,
  onSelect,
  onConsume,
  onIssue,
  onImportAvailable,
  onDismissAvailable,
  onResetHiddenAvailable,
}: OwnableListProps) {
  const packageService = useService("packages");
  const importedEntries = entries.filter((entry) => entry.kind === "imported");
  const availableEntries = entries.filter((entry) => entry.kind === "available");

  return (
    <Box aria-label="Ownable list" role="navigation" className={cn(listPane({ hiddenOnMobile, elevated: consuming !== null }), className)}>
      <Box className="space-y-4">
        <Box className="space-y-2">
          {importedEntries.map(({ chain, package: packageCid, uniqueMessageHash, isConsumed, isLocked, isTransferred }) => {
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

        {(availableEntries.length > 0 || hiddenAvailableOwnablesCount > 0) && (
          <Box className="rounded-[18px] border border-sky-200/70 bg-sky-50/60 p-3 dark:border-sky-900/50 dark:bg-sky-950/20">
            <Box className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Available from Hub
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Import available ownables directly into this wallet.
                </p>
              </div>
              {hiddenAvailableOwnablesCount > 0 ? (
                <Button size="small" variant="ghost" onClick={onResetHiddenAvailable}>
                  Show dismissed Hub items
                </Button>
              ) : null}
            </Box>

            <Box className="space-y-2">
              {availableEntries.length > 0 ? (
                availableEntries.map((entry) => (
                  <OwnableListItem
                    key={entry.id}
                    kind="available"
                    id={entry.id}
                    title={entry.title}
                    description={entry.description}
                    issuer={entry.issuer}
                    availableAt={entry.availableAt}
                    thumbnailUrl={entry.thumbnailUrl}
                    onImport={() => {
                      void onImportAvailable(entry.id);
                    }}
                    onDismiss={() => onDismissAvailable(entry.id)}
                  />
                ))
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  All currently available Hub items are hidden for this account.
                </p>
              )}
            </Box>
          </Box>
        )}
      </Box>

      <IssueOwnableButton
        selected={issueSelected}
        disabled={consuming !== null}
        onClick={() => { if (consuming !== null) return; onIssue(); }}
      />
    </Box>
  );
}
