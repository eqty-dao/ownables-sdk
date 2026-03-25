import { useCallback, useEffect, useState } from "react";
import { EventChain } from "eqty-core";
import { TypedPackage } from "@/interfaces/TypedPackage";
import { useService } from "./useService";
import { useProgress } from "@/contexts/Progress.context";
import { useDialogs } from "@/contexts/Dialogs.context";
import { useChainId } from "wagmi";
import { enqueueSnackbar } from "notistack";
import ownableErrorMessage from "@/utils/ownableErrorMessage";
import LocalStorageService from "@/services/LocalStorage.service";
import { Button } from "@/components/ui";

export interface OwnableEntry {
  chain: EventChain;
  package: string;
  uniqueMessageHash?: string;
  isConsumed?: boolean;
  isLocked?: boolean;
  isTransferred?: boolean;
}

interface UseOwnablesOptions {
  onSelect: (chainId: string) => void;
}

export function useOwnables({ onSelect }: UseOwnablesOptions) {
  const [ownables, setOwnables] = useState<OwnableEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  const ownableService = useService("ownables");
  const packageService = useService("packages");
  const relayService = useService("relay");
  const idb = useService("idb");
  const progress = useProgress();
  const { showError, showConfirm, showAlert } = useDialogs();
  const chainId = useChainId();

  useEffect(() => {
    if (!ownableService) return;
    ownableService.loadAll().then(async (loaded) => {
      setOwnables(loaded);
      await Promise.allSettled(
        loaded.map(({ chain, package: cid }) => ownableService.initWorker(chain.id, cid))
      );
      if (loaded.length > 0) onSelect(loaded[0].chain.id);
      setLoaded(true);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownableService]);

  const getExplorerUrl = (txHash: string, chainId: number) => {
    switch (chainId) {
      case 84532: return `https://sepolia.basescan.org/tx/${txHash}`;
      case 8453:  return `https://basescan.org/tx/${txHash}`;
      default:    return `https://sepolia.basescan.org/tx/${txHash}`;
    }
  };

  const forge = useCallback(async (pkg: TypedPackage) => {
    if (!ownableService) throw new Error("Ownable service not ready");
    try {
      const steps = [{ id: "signEvent", label: "Sign the event" }];
      if (ownableService.anchoring) steps.push({ id: "anchorEvent", label: "Anchor the event" });
      const [ctrl, onProgress] = progress.open({ title: `Forging ${pkg.title}`, steps });
      const result = await ownableService.create(pkg, onProgress);
      setOwnables((prev) => [...prev, { chain: result.chain, package: pkg.cid }]);
      onSelect(result.chain.id);
      ctrl.close();

      if (result.txHash) {
        enqueueSnackbar(`${pkg.title} forged and anchored! TX: ${result.txHash.slice(0, 10)}...`, {
          variant: "success",
          action: (
            <Button className="text-white hover:bg-white/20" size="small"
              onClick={() => window.open(getExplorerUrl(result.txHash!, chainId), "_blank")}>
              View TX
            </Button>
          ),
        });
      } else {
        enqueueSnackbar(`${pkg.title} forged`, { variant: "success" });
      }
    } catch (error) {
      showError("Failed to forge ownable", ownableErrorMessage(error));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownableService, progress, chainId, onSelect, showError]);

  const relayImport = useCallback(async (pkg: TypedPackage[] | null, triggerRefresh: boolean) => {
    if (!pkg || pkg.length === 0) {
      enqueueSnackbar("Nothing to Load from relay", { variant: "error" });
      return;
    }
    try {
      const validPackages = pkg.filter((data) => data.chain && data.cid);
      setOwnables((prev) => {
        const next = [
          ...prev,
          ...validPackages.map((data) => ({
            chain: data.chain,
            package: data.cid,
            uniqueMessageHash: data.uniqueMessageHash,
          })),
        ];
        if (next.length > 0) onSelect(next[next.length - 1].chain.id);
        return next;
      });
      enqueueSnackbar("Ownable successfully loaded", { variant: "success" });
      if (triggerRefresh) {
        showAlert("New Ownables Detected", "New ownables have been detected. Refreshing...");
        setTimeout(() => window.location.reload(), 7000);
      }
    } catch (error) {
      showError("Failed to import from relay", ownableErrorMessage(error));
    }
  }, [onSelect, showError, showAlert]);

  const removeOwnable = useCallback((id: string) => {
    setOwnables((prev) => prev.filter((o) => o.chain.id !== id));
  }, []);

  const deleteOwnable = useCallback((id: string, packageCid: string) => {
    if (!packageService) throw new Error("Package service not ready");
    const pkg = packageService.info(packageCid);
    showConfirm({
      severity: "error",
      title: "Confirm delete",
      message: <span>Are you sure you want to delete this <em>{pkg.title}</em> Ownable?</span>,
      ok: "Delete",
      onConfirm: async () => {
        if (!ownableService) throw new Error("Ownable service not ready");
        setOwnables((current) => current.filter((o) => o.chain.id !== id));
        ownableService.clearRpc(id);
        await ownableService.delete(id);
        const uniqueMessageHash = pkg.uniqueMessageHash;
        if (pkg.isNotLocal) {
          const globalStorage = new LocalStorageService();
          globalStorage.removeByField("packages", "uniqueMessageHash", uniqueMessageHash);
        }
        if (uniqueMessageHash) await relayService?.removeOwnable(uniqueMessageHash);
      },
    });
  }, [packageService, ownableService, relayService, showConfirm]);

  const reset = useCallback(() => {
    if (ownables.length === 0) return;
    showConfirm({
      severity: "error",
      title: "Confirm delete",
      message: <span>Are you sure you want to delete <strong>all Ownables</strong>?</span>,
      ok: "Delete all",
      onConfirm: async () => {
        setOwnables([]);
        await ownableService?.deleteAll();
        enqueueSnackbar("All Ownables are deleted");
      },
    });
  }, [ownables.length, ownableService, showConfirm]);

  const factoryReset = useCallback(() => {
    showConfirm({
      severity: "error",
      title: "Factory reset",
      message: <span>Are you sure you want to delete all Ownables, all packages and your account? <strong>This is a destructive action.</strong></span>,
      ok: "Delete everything",
      onConfirm: async () => {
        setLoaded(false);
        LocalStorageService.clearAll();
        await idb?.deleteAllDatabases();
        window.location.reload();
      },
    });
  }, [idb, showConfirm]);

  return { ownables, setOwnables, loaded, setLoaded, forge, relayImport, removeOwnable, deleteOwnable, reset, factoryReset };
}
