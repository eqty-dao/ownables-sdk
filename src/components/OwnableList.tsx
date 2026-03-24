import { Box } from "@/components/ui";
import { EventChain } from "eqty-core";
import { TypedOwnableInfo } from "@/interfaces/TypedOwnableInfo";
import { useService } from "@/hooks/useService";
import { cva } from "class-variance-authority";
import { cn } from "@/utils/cn";
import OwnableListItem from "./OwnableListItem";
import IssueOwnableButton from "./IssueOwnableButton";

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

interface OwnableListProps {
  ownables: OwnableEntry[];
  selectedChainId: string | null;
  issueSelected: boolean;
  hiddenOnMobile: boolean;
  consuming: ConsumingState | null;
  consumeEligibility: Record<string, boolean>;
  onSelect: (chainId: string) => void;
  onConsume: (consumer: EventChain, consumable: EventChain) => void;
  onIssue: () => void;
}

export default function OwnableList({
  ownables,
  selectedChainId,
  issueSelected,
  hiddenOnMobile,
  consuming,
  consumeEligibility,
  onSelect,
  onConsume,
  onIssue,
}: OwnableListProps) {
  const packageService = useService("packages");

  return (
    <Box aria-label="Ownable list" role="navigation" className={cn(listPane({ hiddenOnMobile, elevated: consuming !== null }))}>
      <Box className="space-y-2">
        {ownables.map(({ chain, package: packageCid, uniqueMessageHash }) => {
          const pkg = packageService?.info(packageCid, uniqueMessageHash);
          return (
            <OwnableListItem
              key={chain.id}
              chain={chain}
              packageCid={packageCid}
              metadata={{ name: pkg?.title ?? "", description: pkg?.description }}
              issuer={chain.events[0]?.signerAddress}
              isConsumable={!!(pkg?.isConsumable)}
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

      <IssueOwnableButton
        selected={issueSelected}
        disabled={consuming !== null}
        onClick={() => { if (consuming !== null) return; onIssue(); }}
      />
    </Box>
  );
}
