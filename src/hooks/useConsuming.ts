import { useCallback, useEffect, useRef, useState } from "react";
import { EventChain } from "eqty-core";
import { TypedOwnableInfo } from "@/interfaces/TypedOwnableInfo";
import { useService } from "./useService";
import { type LogProgress, type ProgressController, useProgress } from "@/contexts/Progress.context";
import { useDialogs } from "@/contexts/Dialogs.context";
import { useOverlay } from "@/contexts/Overlay.context";
import { useBreakpoint } from "./useBreakpoint";
import { enqueueSnackbar } from "notistack";
import {
  isWalletRejection,
  WALLET_REJECTION_MESSAGE,
  default as ownableErrorMessage,
} from "@/utils/ownableErrorMessage";
import { OwnableEntry } from "./useOwnables";

interface ConsumingState {
  chain: EventChain;
  package: string;
  info: TypedOwnableInfo;
}

interface UseConsumingOptions {
  ownables: OwnableEntry[];
  onConsumed: (consumedChainId: string) => void;
}

export function useConsuming({ ownables, onConsumed }: UseConsumingOptions) {
  const [consuming, setConsuming] = useState<ConsumingState | null>(null);
  const [consumeEligibility, setConsumeEligibility] = useState<Record<string, boolean>>({});
  const mountedRef = useRef(true);
  const activeProgressRef = useRef<ProgressController | null>(null);

  const ownableService = useService("ownables");
  const progress = useProgress();
  const { showError } = useDialogs();
  const overlay = useOverlay();
  const isLg = useBreakpoint("lg");

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      activeProgressRef.current?.close();
      activeProgressRef.current = null;
    };
  }, []);

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
    if (isLg) overlay.show();
  }, [isLg, overlay]);

  const cancelConsuming = useCallback(() => {
    setConsuming(null);
    overlay.hide();
  }, [overlay]);

  const consume = useCallback(async (consumer: EventChain, consumable: EventChain) => {
    if (consumer.id === consumable.id) return;
    if (!ownableService) throw new Error("Ownable service not ready");
    const steps = [
      { id: "signConsumableEvent", label: "Sign the consumable event" },
      { id: "signConsumerEvent", label: "Sign the consumer event" },
    ];
    if (ownableService.anchoring) steps.push({ id: "anchor", label: "Anchor both events" });
    const [ctrl, onProgress] = progress.open({ title: "Consuming Ownable", steps });
    activeProgressRef.current = ctrl;
    let activeStepIndex = 0;
    const isCurrentAction = () => mountedRef.current && activeProgressRef.current === ctrl;
    try {
      const trackedProgress: LogProgress = (stepId, meta) => {
        const completedIndex = steps.findIndex((step) => step.id === stepId);
        if (completedIndex >= 0) {
          activeStepIndex = Math.min(completedIndex + 1, steps.length - 1);
        }
        onProgress(stepId, meta);
      };
      await ownableService.consume(consumer, consumable, trackedProgress);
      if (!isCurrentAction()) return;
      setConsuming(null);
      overlay.hide();
      onConsumed(consumable.id);
      enqueueSnackbar("Consumed", { variant: "success" });
      ctrl.close();
    } catch (error) {
      if (!isCurrentAction()) return;
      const cancelled = isWalletRejection(error);
      ctrl.setError(
        activeStepIndex,
        cancelled ? WALLET_REJECTION_MESSAGE : ownableErrorMessage(error)
      );
      ctrl.close();
      if (cancelled) {
        enqueueSnackbar("Consume cancelled", { variant: "info" });
      } else {
        showError("Consume failed", ownableErrorMessage(error));
      }
    } finally {
      if (activeProgressRef.current === ctrl) activeProgressRef.current = null;
    }
  }, [ownableService, progress, onConsumed, showError, overlay]);

  return { consuming, consumeEligibility, startConsuming, cancelConsuming, consume };
}
