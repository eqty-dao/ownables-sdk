import { useCallback, useEffect, useMemo, useState } from "react";
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
import useInterval from "@/hooks/useInterval";
import useEffectiveWallet from "@/hooks/useEffectiveWallet";

const AVAILABLE_OWNABLES_REFRESH_MS = 5000;

export interface OwnableEntry {
  chain: EventChain;
  package: string;
  uniqueMessageHash?: string;
  isConsumed?: boolean;
  isLocked?: boolean;
  isTransferred?: boolean;
}

export interface AvailableOwnableEntry {
  id: string;
  title: string;
  description?: string;
  issuer?: string;
  availableAt: string;
  package: {
    cid: string;
    thumbnailUrl?: string | null;
  };
}

export type MainListEntry =
  | ({ kind: "imported" } & OwnableEntry)
  | ({ kind: "available" } & AvailableOwnableEntry);

interface UseOwnablesOptions {
  onSelect: (chainId: string) => void;
}

export function useOwnables({ onSelect }: UseOwnablesOptions) {
  const [ownables, setOwnables] = useState<OwnableEntry[]>([]);
  const [availableOwnables, setAvailableOwnables] = useState<AvailableOwnableEntry[]>([]);
  const [importingAvailableOwnableId, setImportingAvailableOwnableId] = useState<string | null>(null);
  const [availableOwnablesAccount, setAvailableOwnablesAccount] = useState<string | null>(null);
  const [dismissedAvailableOwnableIds, setDismissedAvailableOwnableIds] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [availableLoaded, setAvailableLoaded] = useState(false);
  const [availableLoadedAccount, setAvailableLoadedAccount] = useState<string | null>(null);

  const ownableService = useService("ownables");
  const packageService = useService("packages");
  const relayService = useService("relay");
  const idb = useService("idb");
  const hub = useService("hub");
  const localStorage = useService("localStorage");
  const progress = useProgress();
  const { showError, showConfirm, showAlert } = useDialogs();
  const chainId = useChainId();
  const { address, isConnected } = useEffectiveWallet();
  const account = address ? `eip155:${chainId}:${address}` : null;
  const dismissedStorageKey = account ? `hub-available:dismissed:${account}` : null;
  const discoveryEnabled =
    !!hub?.recipientDiscoveryEnabled && hub.isConfigured && !!account && isConnected;

  useEffect(() => {
    if (!ownableService) return;
    setLoaded(false);
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

  useEffect(() => {
    if (!dismissedStorageKey || !localStorage) {
      setDismissedAvailableOwnableIds([]);
      return;
    }

    const stored = localStorage.get(dismissedStorageKey);
    setDismissedAvailableOwnableIds(Array.isArray(stored) ? stored : []);
  }, [dismissedStorageKey, localStorage]);

  const refreshAvailableOwnables = useCallback(async () => {
    if (!discoveryEnabled || !hub || !account) {
      setAvailableOwnables([]);
      setAvailableOwnablesAccount(account);
      setAvailableLoaded(true);
      setAvailableLoadedAccount(account);
      return;
    }

    try {
      const response = await hub.listAvailableOwnables(account);
      const entries = [...response.entries].sort(
        (left, right) =>
          new Date(right.availableAt).getTime() - new Date(left.availableAt).getTime()
      );
      setAvailableOwnables(entries);
      setAvailableOwnablesAccount(account);
      setAvailableLoaded(true);
      setAvailableLoadedAccount(account);
    } catch (error) {
      console.warn("Unable to load Hub available ownables", error);
      setAvailableOwnables([]);
      setAvailableOwnablesAccount(account);
      setAvailableLoaded(true);
      setAvailableLoadedAccount(account);
    }
  }, [account, discoveryEnabled, hub]);

  useEffect(() => {
    setAvailableLoaded(false);
    setAvailableLoadedAccount(null);
    setAvailableOwnables([]);
    setAvailableOwnablesAccount(account);
    void refreshAvailableOwnables();
  }, [account, refreshAvailableOwnables]);

  useInterval(() => {
    void refreshAvailableOwnables();
  }, discoveryEnabled ? AVAILABLE_OWNABLES_REFRESH_MS : null);

  useEffect(() => {
    if (!discoveryEnabled) {
      return;
    }

    const refreshOnFocus = () => {
      void refreshAvailableOwnables();
    };

    const refreshOnVisibility = () => {
      if (document.visibilityState === "visible") {
        void refreshAvailableOwnables();
      }
    };

    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnVisibility);

    return () => {
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnVisibility);
    };
  }, [discoveryEnabled, refreshAvailableOwnables]);

  const visibleAvailableOwnables = useMemo(() => {
    if (availableOwnablesAccount !== account) {
      return [];
    }

    const importedOwnableIds = new Set(ownables.map((entry) => entry.chain.id));
    const dismissedIds = new Set(dismissedAvailableOwnableIds);

    return availableOwnables.filter(
      (entry) => !dismissedIds.has(entry.id) && !importedOwnableIds.has(entry.id)
    );
  }, [account, availableOwnables, availableOwnablesAccount, dismissedAvailableOwnableIds, ownables]);

  const hiddenAvailableOwnablesCount = useMemo(() => {
    if (availableOwnablesAccount !== account) {
      return 0;
    }

    const importedOwnableIds = new Set(ownables.map((entry) => entry.chain.id));
    const dismissedIds = new Set(dismissedAvailableOwnableIds);

    return availableOwnables.filter(
      (entry) => dismissedIds.has(entry.id) && !importedOwnableIds.has(entry.id)
    ).length;
  }, [account, availableOwnables, availableOwnablesAccount, dismissedAvailableOwnableIds, ownables]);

  const archivedAvailableOwnables = useMemo(() => {
    if (availableOwnablesAccount !== account) {
      return [];
    }

    const importedOwnableIds = new Set(ownables.map((entry) => entry.chain.id));
    const dismissedIds = new Set(dismissedAvailableOwnableIds);

    return availableOwnables.filter(
      (entry) => dismissedIds.has(entry.id) && !importedOwnableIds.has(entry.id)
    );
  }, [account, availableOwnables, availableOwnablesAccount, dismissedAvailableOwnableIds, ownables]);

  const mainListEntries = useMemo<MainListEntry[]>(
    () => [
      ...ownables.map((entry) => ({ kind: "imported" as const, ...entry })),
      ...visibleAvailableOwnables.map((entry) => ({ kind: "available" as const, ...entry })),
    ],
    [ownables, visibleAvailableOwnables]
  );
  const mainListLoaded =
    loaded &&
    (!discoveryEnabled || (availableLoaded && availableLoadedAccount === account));

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
      const result = await ownableService.create(pkg, onProgress as any);
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
      enqueueSnackbar(`Failed to forge ownable: ${ownableErrorMessage(error)}`, { variant: "error" });
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

  const addImportedOwnable = useCallback(async (pkg: TypedPackage) => {
    if (!pkg.chain) {
      throw new Error("Imported Hub package is missing chain state");
    }

    if (!ownableService) {
      throw new Error("Ownable service not ready");
    }

    await ownableService.init(pkg.chain, pkg.cid);

    setOwnables((prev) => {
      const next = [
        ...prev.filter((entry) => entry.chain.id !== pkg.chain!.id),
        {
          chain: pkg.chain,
          package: pkg.cid,
        },
      ];
      onSelect(pkg.chain.id);
      return next;
    });
  }, [onSelect, ownableService]);

  const dismissAvailableOwnable = useCallback(
    (entryId: string) => {
      if (!dismissedStorageKey || !localStorage) return;

      setDismissedAvailableOwnableIds((prev) => {
        if (prev.includes(entryId)) return prev;
        const next = [...prev, entryId];
        localStorage.set(dismissedStorageKey, next);
        return next;
      });
    },
    [dismissedStorageKey, localStorage]
  );

  const resetDismissedAvailableOwnables = useCallback(() => {
    setDismissedAvailableOwnableIds([]);
    if (dismissedStorageKey && localStorage) {
      localStorage.remove(dismissedStorageKey);
    }
  }, [dismissedStorageKey, localStorage]);

  const restoreDismissedAvailableOwnable = useCallback(
    (entryId: string) => {
      if (!dismissedStorageKey || !localStorage) return;

      setDismissedAvailableOwnableIds((prev) => {
        if (!prev.includes(entryId)) return prev;
        const next = prev.filter((candidate) => candidate !== entryId);
        if (next.length === 0) {
          localStorage.remove(dismissedStorageKey);
        } else {
          localStorage.set(dismissedStorageKey, next);
        }
        return next;
      });
    },
    [dismissedStorageKey, localStorage]
  );

  const importAvailableOwnable = useCallback(
    async (entryId: string) => {
      const entry = availableOwnables.find((candidate) => candidate.id === entryId);
      if (!entry) {
        showError("Hub item unavailable", "This available Hub item is no longer present.");
        return;
      }

      if (!hub || !packageService) {
        showError("Hub import unavailable", "Hub import services are not ready yet.");
        return;
      }

      try {
        setImportingAvailableOwnableId(entryId);
        const { packageFile, chainJson } = await hub.importFromHub(
          entry.package.cid,
          entry.id
        );
        const pkg = await packageService.importFromHub(packageFile, chainJson);

        if (!pkg) {
          throw new Error("Hub package is already imported or no longer current");
        }

        await addImportedOwnable(pkg);
        enqueueSnackbar(`${pkg.title} imported from Hub`, { variant: "success" });
      } catch (error) {
        showError("Failed to import from Hub", ownableErrorMessage(error));
      } finally {
        setImportingAvailableOwnableId((current) => (current === entryId ? null : current));
      }
    },
    [addImportedOwnable, availableOwnables, hub, packageService, showError]
  );

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

  return {
    ownables,
    availableOwnables: visibleAvailableOwnables,
    archivedAvailableOwnables,
    dismissedAvailableOwnableIds,
    importingAvailableOwnableId,
    hiddenAvailableOwnablesCount,
    mainListEntries,
    mainListLoaded,
    setOwnables,
    loaded,
    setLoaded,
    forge,
    relayImport,
    addImportedOwnable,
    importAvailableOwnable,
    dismissAvailableOwnable,
    restoreDismissedAvailableOwnable,
    resetDismissedAvailableOwnables,
    removeOwnable,
    deleteOwnable,
    reset,
    factoryReset,
  };
}
