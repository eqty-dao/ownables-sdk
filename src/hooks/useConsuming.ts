import { useCallback, useEffect, useState } from "react";
import { EventChain } from "eqty-core";
import { TypedOwnableInfo } from "@/interfaces/TypedOwnableInfo";
import { useService } from "./useService";
import { useProgress } from "@/contexts/Progress.context";
import { useDialogs } from "@/contexts/Dialogs.context";
import { useOverlay } from "@/contexts/Overlay.context";
import { enqueueSnackbar } from "notistack";
import ownableErrorMessage from "@/utils/ownableErrorMessage";
import { OwnableEntry } from "./useOwnables";

interface ConsumingState {
  chain: EventChain;
  package: string;
  info: TypedOwnableInfo;
}

interface UseConsumingOptions {
  ownables: OwnableEntry[];
  onConsumed: () => void;
}

export function useConsuming({ ownables, onConsumed }: UseConsumingOptions) {
  const [consuming, setConsuming] = useState<ConsumingState | null>(null);
  const [consumeEligibility, setConsumeEligibility] = useState<Record<string, boolean>>({});

  const ownableService = useService("ownables");
  const progress = useProgress();
  const { showError } = useDialogs();
  const overlay = useOverlay();

  useEffect(() => {
    if (!consuming) { setConsumeEligibility({}); return; }
    const candidates = ownables.filter(({ chain }) => chain.id !== consuming.chain.id);
    Promise.allSettled(
      candidates.map(({ chain, package: pkg }) =>
        ownableService?.canConsume({ chain, package: pkg }, consuming.info)
          .then((eligible) => [chain.id, Boolean(eligible)] as const)
          ?? Promise.resolve([chain.id, false] as const)
      )
    ).then((results) => {
      const eligibility: Record<string, boolean> = {};
      results.forEach((result, i) => {
        if (result.status === "fulfilled") eligibility[candidates[i].chain.id] = result.value[1];
      });
      setConsumeEligibility(eligibility);
    });
  }, [consuming, ownables, ownableService]);

  const startConsuming = useCallback((chain: EventChain, pkg: string, info: TypedOwnableInfo) => {
    setConsuming({ chain, package: pkg, info });
    overlay.show();
  }, [overlay]);

  const cancelConsuming = useCallback(() => {
    setConsuming(null);
    overlay.hide();
  }, [overlay]);

  const consume = useCallback((consumer: EventChain, consumable: EventChain) => {
    if (consumer.id === consumable.id) return;
    if (!ownableService) throw new Error("Ownable service not ready");
    const steps = [
      { id: "signConsumableEvent", label: "Sign the consumable event" },
      { id: "signConsumerEvent", label: "Sign the consumer event" },
    ];
    if (ownableService.anchoring) steps.push({ id: "anchor", label: "Anchor both events" });
    const [ctrl, onProgress] = progress.open({ title: "Consuming Ownable", steps });
    ownableService
      .consume(consumer, consumable, onProgress)
      .then(() => {
        setConsuming(null);
        overlay.hide();
        onConsumed();
        enqueueSnackbar("Consumed", { variant: "success" });
        ctrl.close();
      })
      .catch((error) => showError("Consume failed", ownableErrorMessage(error)));
  }, [ownableService, progress, onConsumed, showError]);

  return { consuming, consumeEligibility, startConsuming, cancelConsuming, consume };
}
