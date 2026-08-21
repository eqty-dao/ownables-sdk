import { useCallback } from "react";
import { EventChain } from "eqty-core";
import { TypedPackage } from "@/interfaces/TypedPackage";
import TypedDict from "@/interfaces/TypedDict";
import { LogProgress } from "@/contexts/Progress.context";
import { useService } from "./useService";
import { useProgress } from "@/contexts/Progress.context";
import { enqueueSnackbar } from "notistack";

type ExecuteFn = (msg: TypedDict, onProgress?: LogProgress, submitAnchors?: boolean) => Promise<void>;

export function useOwnableTransfer(
  chain: EventChain,
  pkg: TypedPackage | undefined,
  execute: ExecuteFn,
  onTransferred?: () => void
) {
  const ownables = useService("ownables");
  const hub = useService("hub");
  const progress = useProgress();

  const transfer = useCallback(async (to: string): Promise<void> => {
    if (!hub || !ownables || !pkg) return;

    const available = await hub.isAvailable();
    if (!available) {
      enqueueSnackbar("Hub is unavailable", { variant: "error" });
      return;
    }

    const steps = [
      { id: "signEvent", label: "Sign the event" },
    ];
    if (ownables.anchoring) steps.push({ id: "anchor", label: "Anchor the event" });
    steps.push({ id: "hubUpload", label: "Upload to Hub" });

    try {
      const [ctrl, onProgress] = progress.open({ title: "Transferring Ownable", steps });

      await execute({ transfer: { to } }, onProgress, false);
      await ownables.submitAnchors(onProgress as any);

      const zip = await ownables.zip(chain);
      const content = await zip.generateAsync({ type: "uint8array" });

      await hub.uploadOwnable(content, `${chain.id}.zip`, onProgress as any);
      onTransferred?.();

      enqueueSnackbar("Ownable transferred through Hub", { variant: "success" });

      ctrl.close();
    } catch (error) {
      console.error("Error during transfer:", error);
      enqueueSnackbar(
        `Transfer failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        { variant: "error" }
      );
    }
  }, [hub, ownables, pkg, chain, execute, onTransferred, progress]);

  return { transfer };
}
