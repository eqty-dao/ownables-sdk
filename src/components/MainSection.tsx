import { EventChain } from "eqty-core";
import { TypedOwnableInfo } from "@/interfaces/TypedOwnableInfo";
import { TypedPackage } from "@/interfaces/TypedPackage";
import { cva } from "class-variance-authority";
import { cn } from "@/utils/cn";
import AvailableOwnableDetail from "./AvailableOwnableDetail";
import Ownable from "./Ownable";
import IssueOwnablePanel from "./IssueOwnablePanel";
import type { AvailableOwnableEntry } from "@/hooks/useOwnables";

const main = cva("min-w-0 flex-1", {
  variants: {
    showOnMobile: {
      true: "block",
      false: "hidden",
    },
  },
  defaultVariants: { showOnMobile: false },
});

interface OwnableEntry {
  chain: EventChain;
  package: string;
  uniqueMessageHash?: string;
}

interface ConsumingState {
  chain: EventChain;
  package: string;
  info: TypedOwnableInfo;
}

interface MainSectionProps {
  ownables: OwnableEntry[];
  availableOwnables: AvailableOwnableEntry[];
  selectedEntryId: string | null;
  showIssuePanel: boolean;
  showDetail: boolean;
  consuming: ConsumingState | null;
  consumeEligibility: Record<string, boolean>;
  isHubAvailable?: boolean | null;
  importingAvailableOwnableId?: string | null;
  onBack: () => void;
  onConsume: (info: TypedOwnableInfo) => void;
  onConsumeComplete: (consumer: EventChain, consumable: EventChain) => void;
  onDelete: (id: string, packageCid: string) => void;
  onRemove: (id: string) => void;
  onImportAvailable: (entryId: string) => void | Promise<void>;
  onArchiveAvailable: (entryId: string) => void;
  onError: (title: string, message: string) => void;
  onForge: (pkg: TypedPackage) => void;
  onCreate: () => void;
}

export default function MainSection({
  ownables,
  availableOwnables,
  selectedEntryId,
  showIssuePanel,
  showDetail,
  consuming,
  isHubAvailable,
  importingAvailableOwnableId,
  onBack,
  onConsume,
  onDelete,
  onRemove,
  onImportAvailable,
  onArchiveAvailable,
  onError,
  onForge,
  onCreate,
}: MainSectionProps) {
  const selectedOwnable = ownables.find(({ chain }) => chain.id === selectedEntryId);
  const selectedAvailableOwnable = availableOwnables.find(({ id }) => id === selectedEntryId);

  return (
    <main
      aria-label="main"
      role="region"
      className={cn(main({ showOnMobile: showDetail }), "lg:block")}
    >
      {showIssuePanel && (
        <IssueOwnablePanel
          onSelect={onForge}
          onError={onError}
          onCreate={onCreate}
          onBack={onBack}
        />
      )}

      {!showIssuePanel && selectedOwnable && (
        <Ownable
          key={selectedOwnable.chain.id}
          chain={selectedOwnable.chain}
          packageCid={selectedOwnable.package}
          uniqueMessageHash={selectedOwnable.uniqueMessageHash}
          selected={consuming?.chain.id === selectedOwnable.chain.id}
          isHubAvailable={isHubAvailable ?? true}
          onDelete={() => onDelete(selectedOwnable.chain.id, selectedOwnable.package)}
          onRemove={() => onRemove(selectedOwnable.chain.id)}
          onConsume={onConsume}
          onError={onError}
          onBack={onBack}
        />
      )}

      {!showIssuePanel && !selectedOwnable && selectedAvailableOwnable && (
        <AvailableOwnableDetail
          ownable={selectedAvailableOwnable}
          isImporting={importingAvailableOwnableId === selectedAvailableOwnable.id}
          onBack={onBack}
          onImport={() => onImportAvailable(selectedAvailableOwnable.id)}
          onArchive={() => onArchiveAvailable(selectedAvailableOwnable.id)}
        />
      )}
    </main>
  );
}
