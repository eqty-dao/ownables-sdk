import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EventChain } from "eqty-core";
import type { ReplayAttemptResult } from "@ownables/core";
import { TypedPackage } from "@/interfaces/TypedPackage";
import { useService } from "./useService";
import { useProgress } from "@/contexts/Progress.context";
import { useDialogs } from "@/contexts/Dialogs.context";
import { useChainId } from "wagmi";
import { enqueueSnackbar } from "notistack";
import { LocalStorageService } from "@ownables/platform-browser";
import ownableErrorMessage from "@/utils/ownableErrorMessage";
import { maybePackageInfo } from "@/utils/maybePackageInfo";
import { Button } from "@/components/ui";
import useEffectiveWallet from "@/hooks/useEffectiveWallet";

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

export type ArchivedListEntry =
  | ({ kind: "imported" } & OwnableEntry)
  | ({ kind: "available" } & AvailableOwnableEntry);

export type MainListEntry =
  | ({ kind: "imported" } & OwnableEntry)
  | ({ kind: "available" } & AvailableOwnableEntry);

interface UseOwnablesOptions {
  onSelect: (chainId: string) => void;
}

function sortAvailableOwnables(entries: AvailableOwnableEntry[]) {
  return [...entries].sort(
    (left, right) =>
      new Date(right.availableAt).getTime() - new Date(left.availableAt).getTime()
  );
}

function mergeAvailableOwnable(
  entries: AvailableOwnableEntry[],
  nextEntry: AvailableOwnableEntry
) {
  return sortAvailableOwnables([
    ...entries.filter((entry) => entry.id !== nextEntry.id),
    nextEntry,
  ]);
}

function replayTouchesTrackedPublicEvents(replay: ReplayAttemptResult) {
  return (
    replay.appliedPublicEvents.length > 0 ||
    replay.duplicatePublicEvents.length > 0 ||
    replay.pendingPublicEvents.length > 0 ||
    replay.confirmedPendingPublicEvents.length > 0 ||
    replay.ignoredPublicEvents.length > 0
  );
}

export function useOwnables({ onSelect }: UseOwnablesOptions) {
  const [ownables, setOwnables] = useState<OwnableEntry[]>([]);
  const [availableOwnables, setAvailableOwnables] = useState<AvailableOwnableEntry[]>([]);
  const [importingAvailableOwnableId, setImportingAvailableOwnableId] = useState<string | null>(null);
  const [availableOwnablesAccount, setAvailableOwnablesAccount] = useState<string | null>(null);
  const [archivedOwnableIds, setArchivedOwnableIds] = useState<string[]>([]);
  const [deletedAvailableOwnableIds, setDeletedAvailableOwnableIds] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [availableLoaded, setAvailableLoaded] = useState(false);
  const [availableLoadedAccount, setAvailableLoadedAccount] = useState<string | null>(null);
  const [publicEventReplayById, setPublicEventReplayById] = useState<
    Record<string, ReplayAttemptResult | undefined>
  >({});

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
  const archivedStorageKey = account ? `ownables:archived:${account}` : null;
  const legacyArchivedStorageKey = account ? `hub-available:dismissed:${account}` : null;
  const deletedAvailableStorageKey = account ? `hub-available:deleted:${account}` : null;
  const discoveryEnabled = !!hub?.isConfigured && !!account && isConnected;
  const availableStreamRef = useRef<{ close(): void } | null>(null);
  const publicEventsStreamRef = useRef<{ close(): void } | null>(null);
  const ownablesRef = useRef(ownables);
  const accountRef = useRef(account);
  const ownableIdsKey = useMemo(
    () => ownables.map((entry) => entry.chain.id).sort().join("|"),
    [ownables]
  );

  useEffect(() => {
    ownablesRef.current = ownables;
  }, [ownables]);

  useEffect(() => {
    accountRef.current = account;
  }, [account]);

  const persistStoredIds = useCallback(
    (storageKey: string | null, ids: string[]) => {
      if (!storageKey || !localStorage) {
        return;
      }

      if (ids.length === 0) {
        localStorage.remove(storageKey);
      } else {
        localStorage.set(storageKey, ids);
      }
    },
    [localStorage]
  );

  useEffect(() => {
    if (!ownableService) return;
    setLoaded(false);
    ownableService.loadAll().then(async (loadedOwnables) => {
      const staleOwnables = packageService
        ? loadedOwnables.filter(
            ({ package: cid, uniqueMessageHash }) =>
              !maybePackageInfo(packageService, cid, uniqueMessageHash)
          )
        : [];
      const validOwnables = packageService
        ? loadedOwnables.filter(
            ({ package: cid, uniqueMessageHash }) =>
              !!maybePackageInfo(packageService, cid, uniqueMessageHash)
          )
        : loadedOwnables;

      if (staleOwnables.length > 0) {
        console.warn(
          "Removing ownables with missing packages",
          staleOwnables.map(({ chain, package: cid }) => ({ chainId: chain.id, packageCid: cid }))
        );
        await Promise.allSettled(
          staleOwnables.map(({ chain }) => ownableService.delete(chain.id))
        );
      }

      setOwnables(validOwnables);
      await Promise.allSettled(
        validOwnables.map(({ chain, package: cid }) => ownableService.initWorker(chain.id, cid))
      );
      if (validOwnables.length > 0) onSelect(validOwnables[0].chain.id);
      setLoaded(true);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownableService, packageService]);

  useEffect(() => {
    if (!archivedStorageKey || !localStorage) {
      setArchivedOwnableIds([]);
      return;
    }

    const stored = localStorage.get(archivedStorageKey);
    if (Array.isArray(stored)) {
      setArchivedOwnableIds(stored);
      return;
    }

    const legacyStored =
      legacyArchivedStorageKey && localStorage
        ? localStorage.get(legacyArchivedStorageKey)
        : undefined;
    const migratedIds = Array.isArray(legacyStored) ? legacyStored : [];
    setArchivedOwnableIds(migratedIds);
    if (migratedIds.length > 0) {
      localStorage.set(archivedStorageKey, migratedIds);
      if (legacyArchivedStorageKey) {
        localStorage.remove(legacyArchivedStorageKey);
      }
    }
  }, [archivedStorageKey, legacyArchivedStorageKey, localStorage]);

  useEffect(() => {
    if (!deletedAvailableStorageKey || !localStorage) {
      setDeletedAvailableOwnableIds([]);
      return;
    }

    const stored = localStorage.get(deletedAvailableStorageKey);
    setDeletedAvailableOwnableIds(Array.isArray(stored) ? stored : []);
  }, [deletedAvailableStorageKey, localStorage]);

  useEffect(() => {
    availableStreamRef.current?.close();
    availableStreamRef.current = null;
    setAvailableLoaded(false);
    setAvailableLoadedAccount(null);
    setAvailableOwnables([]);
    setAvailableOwnablesAccount(account);

    if (!discoveryEnabled || !hub || !account) {
      setAvailableLoaded(true);
      setAvailableLoadedAccount(account);
      return;
    }

    let cancelled = false;

    const connect = async () => {
      try {
        const response = await hub.listAvailableOwnables(account);
        if (cancelled) {
          return;
        }

        setAvailableOwnables(sortAvailableOwnables(response.entries));
      } catch (error) {
        console.warn("Unable to load Hub available ownables", error);
        if (!cancelled) {
          setAvailableOwnables([]);
        }
      } finally {
        if (!cancelled) {
          setAvailableOwnablesAccount(account);
          setAvailableLoaded(true);
          setAvailableLoadedAccount(account);
        }
      }

      if (cancelled) {
        return;
      }

      try {
        availableStreamRef.current = hub.watchAvailableOwnables(account, {
          onEvent: ({ owner, entry }) => {
            if (owner !== accountRef.current) {
              return;
            }

            setAvailableOwnables((current) => mergeAvailableOwnable(current, entry));
            setAvailableOwnablesAccount(owner);
            setAvailableLoaded(true);
            setAvailableLoadedAccount(owner);
          },
          onError: (error) => {
            console.warn("Hub available-ownables stream failed", error);
          },
        });
      } catch (error) {
        console.warn("Unable to connect Hub available-ownables stream", error);
      }
    };

    void connect();

    return () => {
      cancelled = true;
      availableStreamRef.current?.close();
      availableStreamRef.current = null;
    };
  }, [account, discoveryEnabled, hub]);

  const visibleImportedOwnables = useMemo(() => {
    const archivedIds = new Set(archivedOwnableIds);
    return ownables.filter((entry) => !archivedIds.has(entry.chain.id));
  }, [archivedOwnableIds, ownables]);

  const visibleAvailableOwnables = useMemo(() => {
    if (availableOwnablesAccount !== account) {
      return [];
    }

    const importedOwnableIds = new Set(ownables.map((entry) => entry.chain.id));
    const archivedIds = new Set(archivedOwnableIds);
    const deletedIds = new Set(deletedAvailableOwnableIds);

    return availableOwnables.filter(
      (entry) =>
        !archivedIds.has(entry.id) &&
        !deletedIds.has(entry.id) &&
        !importedOwnableIds.has(entry.id)
    );
  }, [
    account,
    archivedOwnableIds,
    availableOwnables,
    availableOwnablesAccount,
    deletedAvailableOwnableIds,
    ownables,
  ]);

  const archivedImportedOwnables = useMemo(
    () => ownables.filter((entry) => archivedOwnableIds.includes(entry.chain.id)),
    [archivedOwnableIds, ownables]
  );

  const archivedAvailableOwnables = useMemo(() => {
    if (availableOwnablesAccount !== account) {
      return [];
    }

    const importedOwnableIds = new Set(ownables.map((entry) => entry.chain.id));
    const archivedIds = new Set(archivedOwnableIds);
    const deletedIds = new Set(deletedAvailableOwnableIds);

    return availableOwnables.filter(
      (entry) =>
        archivedIds.has(entry.id) &&
        !deletedIds.has(entry.id) &&
        !importedOwnableIds.has(entry.id)
    );
  }, [
    account,
    archivedOwnableIds,
    availableOwnables,
    availableOwnablesAccount,
    deletedAvailableOwnableIds,
    ownables,
  ]);

  const archivedEntries = useMemo<ArchivedListEntry[]>(
    () => [
      ...archivedImportedOwnables.map((entry) => ({ kind: "imported" as const, ...entry })),
      ...archivedAvailableOwnables.map((entry) => ({ kind: "available" as const, ...entry })),
    ],
    [archivedAvailableOwnables, archivedImportedOwnables]
  );

  const archivedOwnablesCount = archivedEntries.length;

  const mainListEntries = useMemo<MainListEntry[]>(
    () => [
      ...visibleImportedOwnables.map((entry) => ({ kind: "imported" as const, ...entry })),
      ...visibleAvailableOwnables.map((entry) => ({ kind: "available" as const, ...entry })),
    ],
    [visibleAvailableOwnables, visibleImportedOwnables]
  );

  const mainListLoaded =
    loaded &&
    (!discoveryEnabled || (availableLoaded && availableLoadedAccount === account));

  const syncTrackedPublicEvents = useCallback(
    async (entryId: string, replay: ReplayAttemptResult) => {
      if (!ownableService || !replayTouchesTrackedPublicEvents(replay)) {
        return;
      }

      setPublicEventReplayById((current) => ({ ...current, [entryId]: replay }));
    },
    [ownableService]
  );

  useEffect(() => {
    publicEventsStreamRef.current?.close();
    publicEventsStreamRef.current = null;

    if (!hub?.isConfigured || !ownableService || ownables.length === 0) {
      return;
    }

    let cancelled = false;

    const connect = async () => {
      const latestBlocks: number[] = [];
      const watchedOwnableIds = ownables.map((entry) => entry.chain.id);

      for (const entry of ownables) {
        try {
          const snapshot = await hub.loadOwnablePublicEvents(entry.chain.id);
          if (cancelled) {
            return;
          }

          const replay = await ownableService.applyIndexedPublicEventSnapshot(
            entry.chain,
            snapshot.publicEvents
          );
          await syncTrackedPublicEvents(entry.chain.id, replay);

          latestBlocks.push(
            snapshot.publicEvents.reduce(
              (max, event) => Math.max(max, Number(event.blockNumber ?? 0)),
              0
            )
          );
        } catch (error) {
          console.warn(
            `Unable to load or apply Hub public-events snapshot for ${entry.chain.id}`,
            error
          );
        }
      }

      if (cancelled) {
        return;
      }

      try {
        if (cancelled) {
          return;
        }

        publicEventsStreamRef.current = hub.watchOwnablePublicEvents(
          watchedOwnableIds,
          {
            onEvent: async ({ ownableId, publicEvent }) => {
              const entry = ownablesRef.current.find(
                (candidate) => candidate.chain.id === ownableId
              );
              if (!entry) {
                return;
              }

              try {
                const replay = await ownableService.applyIndexedPublicEventStream(
                  entry.chain,
                  [publicEvent]
                );
                await syncTrackedPublicEvents(ownableId, replay);
              } catch (error) {
                console.warn("Unable to apply Hub public-event stream update", error);
              }
            },
            onError: (error) => {
              console.warn("Hub public-events stream failed", error);
            },
          },
          {
            fromBlock:
              latestBlocks.length > 0 ? Math.min(...latestBlocks) : 0,
          }
        );
      } catch (error) {
        console.warn("Unable to connect Hub public-events transport", error);
      }
    };

    void connect();

    return () => {
      cancelled = true;
      publicEventsStreamRef.current?.close();
      publicEventsStreamRef.current = null;
    };
  }, [hub, ownableIdsKey, ownables, ownableService, syncTrackedPublicEvents]);

  const getExplorerUrl = (txHash: string, currentChainId: number) => {
    switch (currentChainId) {
      case 84532:
        return `https://sepolia.basescan.org/tx/${txHash}`;
      case 8453:
        return `https://basescan.org/tx/${txHash}`;
      default:
        return `https://sepolia.basescan.org/tx/${txHash}`;
    }
  };

  const forge = useCallback(async (pkg: TypedPackage) => {
    if (!ownableService) throw new Error("Ownable service not ready");
    try {
      const steps = [{ id: "signEvent", label: "Sign the event" }];
      if (ownableService.anchoring) steps.push({ id: "anchorEvent", label: "Anchor the event" });
      const [ctrl, onProgress] = progress.open({ title: `Forging ${pkg.title}`, steps });
      const result = await ownableService.create(pkg, onProgress as any);
      await ownableService.init(result.chain, pkg.cid, pkg.uniqueMessageHash);
      setOwnables((prev) => [...prev, { chain: result.chain, package: pkg.cid }]);
      onSelect(result.chain.id);
      ctrl.close();

      if (result.txHash) {
        enqueueSnackbar(`${pkg.title} forged and anchored! TX: ${result.txHash.slice(0, 10)}...`, {
          variant: "success",
          action: (
            <Button
              className="text-white hover:bg-white/20"
              size="small"
              onClick={() => window.open(getExplorerUrl(result.txHash!, chainId), "_blank")}
            >
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
  }, [onSelect, showAlert, showError]);

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

  const archiveOwnable = useCallback((entryId: string) => {
    setArchivedOwnableIds((prev) => {
      if (prev.includes(entryId)) return prev;
      const next = [...prev, entryId];
      persistStoredIds(archivedStorageKey, next);
      return next;
    });
  }, [archivedStorageKey, persistStoredIds]);

  const restoreArchivedOwnable = useCallback((entryId: string) => {
    setArchivedOwnableIds((prev) => {
      if (!prev.includes(entryId)) return prev;
      const next = prev.filter((candidate) => candidate !== entryId);
      persistStoredIds(archivedStorageKey, next);
      return next;
    });
  }, [archivedStorageKey, persistStoredIds]);

  const markAvailableOwnableDeleted = useCallback((entryId: string) => {
    setDeletedAvailableOwnableIds((prev) => {
      if (prev.includes(entryId)) return prev;
      const next = [...prev, entryId];
      persistStoredIds(deletedAvailableStorageKey, next);
      return next;
    });
  }, [deletedAvailableStorageKey, persistStoredIds]);

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
        restoreArchivedOwnable(entryId);
        enqueueSnackbar(`${pkg.title} imported from Hub`, { variant: "success" });
      } catch (error) {
        showError("Failed to import from Hub", ownableErrorMessage(error));
      } finally {
        setImportingAvailableOwnableId((current) => (current === entryId ? null : current));
      }
    },
    [addImportedOwnable, availableOwnables, hub, packageService, restoreArchivedOwnable, showError]
  );

  const updateOwnable = useCallback((entryId: string, patch: Partial<OwnableEntry>) => {
    setOwnables((prev) =>
      prev.map((entry) => (entry.chain.id === entryId ? { ...entry, ...patch } : entry))
    );
  }, []);

  const permanentlyDeleteImportedOwnable = useCallback((id: string, packageCid: string) => {
    if (!packageService) throw new Error("Package service not ready");
    const pkg = maybePackageInfo(packageService, packageCid);
    const packageTitle = pkg?.title ?? "unknown";
    showConfirm({
      severity: "error",
      title: "Confirm delete",
      message: <span>Are you sure you want to delete this <em>{packageTitle}</em> Ownable?</span>,
      ok: "Delete",
      onConfirm: async () => {
        if (!ownableService) throw new Error("Ownable service not ready");
        setOwnables((current) => current.filter((entry) => entry.chain.id !== id));
        restoreArchivedOwnable(id);
        ownableService.clearRpc(id);
        await ownableService.delete(id);
        const uniqueMessageHash = pkg?.uniqueMessageHash;
        if (pkg?.isNotLocal) {
          const globalStorage = new LocalStorageService();
          globalStorage.removeByField("packages", "uniqueMessageHash", uniqueMessageHash);
        }
        if (uniqueMessageHash) await relayService?.removeOwnable(uniqueMessageHash);
      },
    });
  }, [ownableService, packageService, relayService, restoreArchivedOwnable, showConfirm]);

  const permanentlyDeleteAvailableOwnable = useCallback((entryId: string, title: string) => {
    showConfirm({
      severity: "error",
      title: "Confirm delete",
      message: <span>Are you sure you want to permanently delete <em>{title}</em> from this wallet?</span>,
      ok: "Delete",
      onConfirm: () => {
        restoreArchivedOwnable(entryId);
        markAvailableOwnableDeleted(entryId);
      },
    });
  }, [markAvailableOwnableDeleted, restoreArchivedOwnable, showConfirm]);

  const permanentlyDeleteArchivedOwnable = useCallback((entryId: string) => {
    const importedOwnable = ownables.find((entry) => entry.chain.id === entryId);
    if (importedOwnable) {
      permanentlyDeleteImportedOwnable(importedOwnable.chain.id, importedOwnable.package);
      return;
    }

    const availableOwnable = availableOwnables.find((entry) => entry.id === entryId);
    if (availableOwnable) {
      permanentlyDeleteAvailableOwnable(availableOwnable.id, availableOwnable.title);
    }
  }, [availableOwnables, ownables, permanentlyDeleteAvailableOwnable, permanentlyDeleteImportedOwnable]);

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

  const notifyOwnablePublicEventsChanged = useCallback(
    async (entryId: string, replay: ReplayAttemptResult) => {
      await syncTrackedPublicEvents(entryId, replay);
    },
    [syncTrackedPublicEvents]
  );

  return {
    ownables,
    availableOwnables: visibleAvailableOwnables,
    archivedAvailableOwnables,
    archivedImportedOwnables,
    archivedEntries,
    archivedOwnableIds,
    importingAvailableOwnableId,
    archivedOwnablesCount,
    mainListEntries,
    mainListLoaded,
    publicEventReplayById,
    setOwnables,
    loaded,
    setLoaded,
    forge,
    relayImport,
    addImportedOwnable,
    importAvailableOwnable,
    archiveOwnable,
    restoreArchivedOwnable,
    permanentlyDeleteArchivedOwnable,
    notifyOwnablePublicEventsChanged,
    updateOwnable,
    reset,
    factoryReset,
  };
}
