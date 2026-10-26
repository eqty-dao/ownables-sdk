import { useCallback, useEffect, useRef } from "react";
import { EventChain } from "eqty-core";
import { TypedPackage } from "@/interfaces/TypedPackage";
import TypedDict from "@/interfaces/TypedDict";
import { LogProgress, type ProgressController } from "@/contexts/Progress.context";
import { useService } from "./useService";
import { useProgress } from "@/contexts/Progress.context";
import { enqueueSnackbar } from "notistack";

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
    try {
      const [ctrl, onProgress] = progress.open({ title: "Transferring Ownable", steps });
      controller = ctrl;
      activeProgressRef.current = ctrl;
      const isCurrentAction = () => mountedRef.current && activeProgressRef.current === ctrl;

      await execute({ transfer: { to } }, onProgress, false, [], false, isCurrentAction);
      if (!isCurrentAction()) return;

      const zip = await ownables.zip(chain);
      const content = await zip.generateAsync({ type: "uint8array" });

      ctrl.setActive(1);
      await hub.uploadOwnable(content, `${chain.id}.zip`, onProgress as any);
      if (!isCurrentAction()) return;
      if (ownables.anchoring) ctrl.setActive(2);
      await ownables.submitAnchors(onProgress as any);
      if (!isCurrentAction()) return;
      onTransferred?.();

      enqueueSnackbar("Ownable transferred through Hub", { variant: "success" });

      ctrl.close();
    } catch (error) {
      if (!mountedRef.current || activeProgressRef.current !== controller) return;
      controller?.close();
      activeProgressRef.current = null;
      console.error("Error during transfer:", error);
      enqueueSnackbar(
        `Transfer failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        { variant: "error" }
      );
    } finally {
      if (activeProgressRef.current === controller) activeProgressRef.current = null;
    }
  }, [hub, ownables, pkg, chain, execute, onTransferred, progress]);

  return { transfer };
}
