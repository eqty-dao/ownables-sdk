import { useCallback, useEffect, useRef } from "react";
import { EventChain } from "eqty-core";
import { TypedPackage } from "@/interfaces/TypedPackage";
import TypedDict from "@/interfaces/TypedDict";
import { LogProgress, type ProgressController } from "@/contexts/Progress.context";
import { useService } from "./useService";
import { useProgress } from "@/contexts/Progress.context";
import { enqueueSnackbar } from "notistack";
import {
  isWalletRejection,
  WALLET_REJECTION_MESSAGE,
  default as ownableErrorMessage,
} from "@/utils/ownableErrorMessage";

type ExecuteFn = (
  msg: TypedDict,
  onProgress?: LogProgress,
  submitAnchors?: boolean,
  eventAttachments?: Array<{ name: string; file: File }>,
  reportError?: boolean,
  isCurrentAction?: () => boolean
) => Promise<void>;

export function useOwnableTransfer(
  chain: EventChain,
  pkg: TypedPackage | undefined,
  execute: ExecuteFn,
  onTransferred?: () => void
) {
  const ownables = useService("ownables");
  const hub = useService("hub");
  const progress = useProgress();
  const mountedRef = useRef(true);
  const activeProgressRef = useRef<ProgressController | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      activeProgressRef.current?.close();
      activeProgressRef.current = null;
    };
  }, []);

  const transfer = useCallback(async (to: string): Promise<void> => {
    if (!hub || !ownables || !pkg) return;

    const available = await hub.isAvailable();
    if (!available) {
      enqueueSnackbar("Hub is unavailable", { variant: "error" });
      return;
    }

    const steps = [
      { id: "signEvent", label: "Sign the event" },
      { id: "hubUpload", label: "Upload to Hub" },
    ];
    if (ownables.anchoring) steps.push({ id: "anchor", label: "Anchor the event" });

    let controller: ProgressController | null = null;
    let activeStepIndex = 0;
    try {
      const [ctrl, onProgress] = progress.open({ title: "Transferring Ownable", steps });
      controller = ctrl;
      activeProgressRef.current = ctrl;
      const isCurrentAction = () => mountedRef.current && activeProgressRef.current === ctrl;
      const trackedProgress: LogProgress = (stepId, meta) => {
        const completedIndex = steps.findIndex((step) => step.id === stepId);
        if (completedIndex >= 0) {
          activeStepIndex = Math.min(completedIndex + 1, steps.length - 1);
        }
        onProgress(stepId, meta);
      };

      await execute({ transfer: { to } }, trackedProgress, false, [], false, isCurrentAction);
      if (!isCurrentAction()) return;

      const zip = await ownables.zip(chain);
      const content = await zip.generateAsync({ type: "uint8array" });

      ctrl.setActive(1);
      activeStepIndex = 1;
      await hub.uploadOwnable(content, `${chain.id}.zip`, trackedProgress as any);
      if (!isCurrentAction()) return;
      if (ownables.anchoring) {
        ctrl.setActive(2);
        activeStepIndex = 2;
      }
      await ownables.submitAnchors(trackedProgress as any);
      if (!isCurrentAction()) return;
      onTransferred?.();

      enqueueSnackbar("Ownable transferred through Hub", { variant: "success" });

      ctrl.close();
    } catch (error) {
      if (!mountedRef.current || activeProgressRef.current !== controller) return;
      const cancelled = isWalletRejection(error);
      controller?.setError(
        activeStepIndex,
        cancelled ? WALLET_REJECTION_MESSAGE : ownableErrorMessage(error)
      );
      controller?.close();
      activeProgressRef.current = null;
      console.error("Error during transfer:", error);
      enqueueSnackbar(
        cancelled ? "Transfer cancelled" : `Transfer failed: ${ownableErrorMessage(error)}`,
        { variant: cancelled ? "info" : "error" }
      );
    } finally {
      if (activeProgressRef.current === controller) activeProgressRef.current = null;
    }
  }, [hub, ownables, pkg, chain, execute, onTransferred, progress]);

  return { transfer };
}
