import { Box } from "@/components/ui";
import { EventChain } from "eqty-core";
import { TypedOwnableInfo } from "@/interfaces/TypedOwnableInfo";
import { TypedPackage } from "@/interfaces/TypedPackage";
import { cva } from "class-variance-authority";
import { cn } from "@/utils/cn";
import Ownable from "./Ownable";
import IssueOwnablePanel from "./IssueOwnablePanel";

const detailPane = cva("min-w-0 flex-1", {
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

interface OwnableCardProps {
  ownables: OwnableEntry[];
  selectedChainId: string | null;
  showIssuePanel: boolean;
  showDetail: boolean;
  consuming: ConsumingState | null;
  consumeEligibility: Record<string, boolean>;
  message: number;
  onBack: () => void;
  onConsume: (info: TypedOwnableInfo) => void;
  onConsumeComplete: (consumer: EventChain, consumable: EventChain) => void;
  onDelete: (id: string, packageCid: string) => void;
  onRemove: (id: string) => void;
  onError: (title: string, message: string) => void;
  onForge: (pkg: TypedPackage) => void;
  onImportFR: (pkg: TypedPackage[] | null, triggerRefresh: boolean) => void;
  onCreate: () => void;
}

export default function OwnableCard({
  ownables,
  selectedChainId,
  showIssuePanel,
  showDetail,
  consuming,
  consumeEligibility,
  message,
  onBack,
  onConsume,
  onConsumeComplete,
  onDelete,
  onRemove,
  onError,
  onForge,
  onImportFR,
  onCreate,
}: OwnableCardProps) {
  const selectedOwnable = ownables.find(({ chain }) => chain.id === selectedChainId);

  return (
    <Box
      aria-label="Ownable detail"
      role="region"
      className={cn(detailPane({ showOnMobile: showDetail }), "lg:block")}
    >
      {showIssuePanel && (
        <IssueOwnablePanel
          onSelect={onForge}
          onImportFR={onImportFR}
          onError={onError}
          onCreate={onCreate}
          message={message}
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
          onDelete={() => onDelete(selectedOwnable.chain.id, selectedOwnable.package)}
          onRemove={() => onRemove(selectedOwnable.chain.id)}
          onConsume={onConsume}
          onError={onError}
          onBack={onBack}
        />
      )}
    </Box>
  );
}
