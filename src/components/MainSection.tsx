import { EventChain } from "eqty-core";
import type { ReplayAttemptResult } from "@ownables/core";
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
  archivedAvailableOwnables: AvailableOwnableEntry[];
  selectedEntryId: string | null;
  showIssuePanel: boolean;
  showDetail: boolean;
  consuming: ConsumingState | null;
  consumeEligibility: Record<string, boolean>;
  isHubAvailable?: boolean | null;
  isArchivedSelected?: boolean;
  importingAvailableOwnableId?: string | null;
  onBack: () => void;
  onConsume: (info: TypedOwnableInfo) => void;
  onConsumeComplete: (consumer: EventChain, consumable: EventChain) => void;
  onArchive: (id: string) => void;
  onRestore: (id: string) => void;
  onDelete: (id: string, packageCid: string) => void;
  onDeleteArchived: (entryId: string) => void;
  onImportAvailable: (entryId: string) => void | Promise<void>;
  onArchiveAvailable: (entryId: string) => void;
  onError: (title: string, message: string) => void;
  onForge: (pkg: TypedPackage) => void;
  onCreate: () => void;
  packageRefreshToken?: number;
  publicEventRefreshTokenById?: Record<string, number>;
  onOwnablePublicEventsChanged?: (
    entryId: string,
    replay: ReplayAttemptResult
  ) => void | Promise<void>;
}

export default function MainSection({
  ownables,
  availableOwnables,
  archivedAvailableOwnables,
  selectedEntryId,
  showIssuePanel,
  showDetail,
  consuming,
  isHubAvailable,
  isArchivedSelected = false,
  importingAvailableOwnableId,
  onBack,
  onConsume,
  onArchive,
  onRestore,
  onDelete,
  onDeleteArchived,
  onImportAvailable,
  onArchiveAvailable,
  onError,
  onForge,
  onCreate,
  packageRefreshToken = 0,
  publicEventRefreshTokenById = {},
  onOwnablePublicEventsChanged,
}: MainSectionProps) {
  const selectedOwnable = ownables.find(({ chain }) => chain.id === selectedEntryId);
  const selectedAvailableOwnable =
    availableOwnables.find(({ id }) => id === selectedEntryId) ??
    archivedAvailableOwnables.find(({ id }) => id === selectedEntryId);

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
          packageRefreshToken={packageRefreshToken}
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
          archived={isArchivedSelected}
          isHubAvailable={isHubAvailable ?? true}
          publicEventRefreshToken={
            publicEventRefreshTokenById[selectedOwnable.chain.id] ?? 0
          }
          onArchive={() => onArchive(selectedOwnable.chain.id)}
          onRestore={() => onRestore(selectedOwnable.chain.id)}
          onDelete={() => onDelete(selectedOwnable.chain.id, selectedOwnable.package)}
          onConsume={onConsume}
          onTransferred={() => {
            onArchive(selectedOwnable.chain.id);
          }}
          onError={onError}
          onPublicEventsChanged={onOwnablePublicEventsChanged}
          onBack={onBack}
        />
      )}

      {!showIssuePanel && !selectedOwnable && selectedAvailableOwnable && (
        <AvailableOwnableDetail
          ownable={selectedAvailableOwnable}
          archived={isArchivedSelected}
          isImporting={importingAvailableOwnableId === selectedAvailableOwnable.id}
          onBack={onBack}
          onImport={() => onImportAvailable(selectedAvailableOwnable.id)}
          onArchive={() => onArchiveAvailable(selectedAvailableOwnable.id)}
          onRestore={() => onRestore(selectedAvailableOwnable.id)}
          onDelete={() => onDeleteArchived(selectedAvailableOwnable.id)}
        />
      )}
    </main>
  );
}
