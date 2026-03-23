import { useEffect, useState } from "react";
import { isE2E } from "./utils/isE2E";
import { AlertColor, Box, Button, CircularProgress, IconButton, Link } from "@/components/ui";
import { ArrowLeft as ArrowBack, Plus } from "lucide-react";
import IssueOwnablePanel from "./components/IssueOwnablePanel";
import { TypedPackage } from "./interfaces/TypedPackage";
import LoginDialog from "./components/LoginDialog";
import Loading from "./components/Loading";
import Sidebar from "./components/Sidebar";
import { ViewMessagesBar } from "./components/ViewMessagesBar";
import { HAS_EXAMPLES } from "./services/Package.service";
import * as React from "react";
import Ownable from "./components/Ownable";
import OwnableListItem from "./components/OwnableListItem";
import { EventChain } from "eqty-core";
import HelpDrawer from "./components/HelpDrawer";
import AppToolbar from "./components/AppToolbar";
import AlertDialog from "./components/AlertDialog";
import ownableErrorMessage from "./utils/ownableErrorMessage";
import Overlay from "./components/Overlay";
import ConfirmDialog from "./components/ConfirmDialog";
import { SnackbarProvider, enqueueSnackbar } from "notistack";
import { TypedOwnableInfo } from "./interfaces/TypedOwnableInfo";
import { usePackageManager } from "./hooks/usePackageManager";
import { useAccount, useChainId, useConnect } from "wagmi";
import { useMessageCount } from "./hooks/useMessageCount";
import { useService } from "./hooks/useService";
import LocalStorageService from "./services/LocalStorage.service";
import CreateOwnableDialog from "./components/CreateOwnableDialog";
import { useProgress } from "./contexts/Progress.context";
import { cva } from "class-variance-authority";
import { cn } from "./utils/cn";

const listPane = cva(
  "w-full flex-shrink-0 px-4 lg:w-[384px]",
  {
    variants: {
      hiddenOnMobile: {
        true: "hidden lg:block",
        false: "block",
      },
    },
    defaultVariants: {
      hiddenOnMobile: false,
    },
  }
);

const detailPane = cva("min-w-0 flex-1", {
  variants: {
    showOnMobile: {
      true: "block",
      false: "hidden",
    },
  },
  defaultVariants: {
    showOnMobile: false,
  },
});

const emptyStateLink = cva("pointer-events-auto link-primary underline");
const issueOwnableButton = cva(
  "mt-2 flex w-full items-start justify-start gap-3 rounded-[14px] border-2 p-4 border-dashed text-left transition-all",
  {
    variants: {
      selected: {
        true: "border-indigo-500 bg-indigo-50 shadow-md dark:bg-indigo-950/30",
        false: "border-slate-300 bg-transparent hover:border-indigo-400 dark:border-[#333333] dark:hover:border-indigo-500",
      },
      dimmed: {
        true: "cursor-not-allowed opacity-40",
        false: "",
      },
    },
    defaultVariants: { selected: false, dimmed: false },
  }
);

export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showViewMessagesBar, setShowViewMessagesBar] = useState(false);
  const ISSUE_OWNABLE_ID = "issue";
  const [showCreateOwnable, setShowCreateOwnable] = React.useState(false);
  const [message, setMessages] = useState(0);
  const [ownables, setOwnables] = useState<
    Array<{ chain: EventChain; package: string; uniqueMessageHash?: string }>
  >([]);
  const [selectedChainId, setSelectedChainId] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [consuming, setConsuming] = useState<{
    chain: EventChain;
    package: string;
    info: TypedOwnableInfo;
  } | null>(null);
  const [consumeEligibility, setConsumeEligibility] = useState<Record<string, boolean>>({});
  const [alert, setAlert] = useState<{
    title: string;
    message: React.ReactNode;
    severity: AlertColor;
  } | null>(null);
  const [confirm, setConfirm] = useState<{
    title: string;
    message: React.ReactNode;
    severity?: AlertColor;
    ok?: string;
    onConfirm: () => void;
  } | null>(null);

  const ownableService = useService("ownables");
  const packageService = useService("packages");
  const relayService = useService("relay");
  const idb = useService("idb");
  const { isLoading: isPackageManagerLoading } = usePackageManager();
  const progress = useProgress();

  const handleNotificationClick = () => {
    // Open messages view - it will fetch messages when opened
    setShowViewMessagesBar(true);
  };

  const { setMessageCount } = useMessageCount();

  const { address, isConnected, isConnecting } = useAccount();
  const chainId = useChainId();
  const { error: connectError } = useConnect();

  useEffect(() => {
    if (!ownableService) return;

    ownableService.loadAll().then(async (loaded) => {
      setOwnables(loaded);
      // Phase 1: initialize workers for all ownables so canConsume works without rendering
      await Promise.allSettled(
        loaded.map(({ chain, package: cid }) =>
          ownableService.initWorker(chain.id, cid)
        )
      );
      if (loaded.length > 0) setSelectedChainId(loaded[0].chain.id);
      setLoaded(true);
    });
  }, [ownableService]);


  useEffect(() => {
    setShowLogin(!isConnected && !isE2E);

    setShowSidebar(false);
    setShowViewMessagesBar(false);
    setConsuming(null);
    setAlert(null);
    setConfirm(null);

    // Only clear ownables if wallet is disconnected, not on every change
    if (!isConnected) {
      setOwnables([]);
    }
  }, [address, isConnected, chainId]);

  // Handle connection errors
  useEffect(() => {
    if (connectError) {
      if (connectError.name !== "ConnectorAlreadyConnectedError") {
        showError("Connection Error", connectError.message);
      }
    }
  }, [connectError]);

  const showError = (title: string, message: string) => {
    setAlert({ severity: "error", title, message });
  };

  const removeOwnable = (ownableId: string) => {
    setOwnables((prevOwnables) =>
      prevOwnables.filter((ownable) => ownable.chain.id !== ownableId)
    );
  };

  const getExplorerUrl = (txHash: string, chainId: number) => {
    switch (chainId) {
      case 84532: // Base Sepolia
        return `https://sepolia.basescan.org/tx/${txHash}`;
      case 8453: // Base Mainnet
        return `https://basescan.org/tx/${txHash}`;
      default:
        return `https://sepolia.basescan.org/tx/${txHash}`;
    }
  };

  const forge = async (pkg: TypedPackage) => {
    if (!ownableService) throw new Error("Ownable service not ready");

    try {
      // Open progress modal for instantiation (2 steps when anchoring enabled, otherwise 1)
      const steps = [{ id: 'signEvent', label: 'Sign the event' }];
      if (ownableService.anchoring) steps.push({ id: 'anchorEvent', label: 'Anchor the event' });
      const [ctrl, onProgress] = progress.open({ title: `Forging ${pkg.title}`, steps });
      const result = await ownableService.create(pkg, onProgress);
      setOwnables([...ownables, { chain: result.chain, package: pkg.cid }]);
      setSelectedChainId(result.chain.id);
      ctrl.close();

      if (result.txHash) {
        const explorerUrl = getExplorerUrl(result.txHash, chainId);
        enqueueSnackbar(
          `${pkg.title} forged and anchored! TX: ${result.txHash.slice(
            0,
            10
          )}...`,
          {
            variant: "success",
            action: (
              <Button
                className="text-white hover:bg-white/20"
                size="small"
                onClick={() => window.open(explorerUrl, "_blank")}
              >
                View TX
              </Button>
            ),
          }
        );
      } else {
        enqueueSnackbar(`${pkg.title} forged`, { variant: "success" });
      }
    } catch (error) {
      showError("Failed to forge ownable", ownableErrorMessage(error));
    }
  };

  const relayImport = async (
    pkg: TypedPackage[] | null,
    triggerRefresh: boolean
  ) => {
    if (!pkg || pkg.length === 0) {
      enqueueSnackbar(`Nothing to Load from relay`, { variant: "error" });
      return;
    }

    try {
      // Process packages
      const validPackages = pkg.filter(
        (data: TypedPackage) => data.chain && data.cid
      );

      setOwnables((prevOwnables) => {
        const next = [
          ...prevOwnables,
          ...validPackages.map((data: TypedPackage) => ({
            chain: data.chain,
            package: data.cid,
            uniqueMessageHash: data.uniqueMessageHash,
          })),
        ];
        if (!selectedChainId && next.length > 0)
          setSelectedChainId(next[0].chain.id);
        return next;
      });

      enqueueSnackbar(`Ownable successfully loaded`, { variant: "success" });
      await setMessageCount(0);
      setMessages(0);

      // Trigger a refresh only for updated ownables
      if (triggerRefresh) {
        setAlert({
          severity: "info",
          title: "New Ownables Detected",
          message: "New ownables have been detected. Refreshing...",
        });

        setTimeout(() => {
          window.location.reload();
        }, 7000);
      }
    } catch (error) {
      showError("Failed to import from relay", ownableErrorMessage(error));
    }
  };

  const deleteOwnable = (id: string, packageCid: string) => {
    if (!packageService) throw new Error("Package service not ready");
    const pkg = packageService.info(packageCid);

    setConfirm({
      severity: "error",
      title: "Confirm delete",
      message: (
        <span>
          Are you sure you want to delete this <em>{pkg.title}</em> Ownable?
        </span>
      ),
      ok: "Delete",
      onConfirm: async () => {
        if (!ownableService) throw new Error("Ownable service not ready");

        setOwnables((current) =>
          current.filter((ownable) => ownable.chain.id !== id)
        );
        //Delete ownable
        ownableService.clearRpc(id);
        await ownableService.delete(id);

        //delete ownable from relay
        const uniqueMessageHash = pkg.uniqueMessageHash;

        //delete package
        if (pkg.isNotLocal && packageService) {
          // Packages are stored globally, not per-account
          const globalStorage = new LocalStorageService();
          globalStorage.removeByField(
            "packages",
            "uniqueMessageHash",
            uniqueMessageHash
          );
        }

        if (uniqueMessageHash) {
          await relayService?.removeOwnable(uniqueMessageHash);
        }
      },
    });
  };

  const canConsume = async (consumer: {
    chain: EventChain;
    package: string;
  }): Promise<boolean> => {
    return Boolean(
      consuming?.info &&
        (await ownableService?.canConsume(consumer, consuming!.info))
    );
  };

  // Compute eligibility for all non-consuming ownables when consume mode activates
  useEffect(() => {
    if (!consuming) { setConsumeEligibility({}); return; }
    const candidates = ownables.filter(({ chain }) => chain.id !== consuming.chain.id);
    Promise.allSettled(
      candidates.map(({ chain, package: pkg }) =>
        canConsume({ chain, package: pkg }).then((eligible) => [chain.id, eligible] as const)
      )
    ).then((results) => {
      const eligibility: Record<string, boolean> = {};
      results.forEach((result, i) => {
        if (result.status === "fulfilled") eligibility[candidates[i].chain.id] = result.value[1];
      });
      setConsumeEligibility(eligibility);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consuming]);

  const consume = (consumer: EventChain, consumable: EventChain) => {
    if (consumer.id === consumable.id) return;
    if (!ownableService) throw new Error("Ownable service not ready");

    const steps: Array<{ id: string; label: string }> = [
      { id: 'signConsumableEvent', label: 'Sign the consumable event' },
      { id: 'signConsumerEvent', label: 'Sign the consumer event' },
    ];
    if (ownableService.anchoring) steps.push({ id: 'anchor', label: 'Anchor both events' });

    const [ctrl, onProgress] = progress.open({ title: 'Consuming Ownable', steps });

    ownableService
      .consume(consumer, consumable, onProgress)
      .then(() => {
        setConsuming(null);
        setOwnables((ownables) => [...ownables]);
        enqueueSnackbar("Consumed", { variant: "success" });
        ctrl.close();
      })
      .catch((error) => {
        // Keep modal open on error; user can dismiss
        showError("Consume failed", ownableErrorMessage(error));
      });
  };

  const reset = async () => {
    setShowSidebar(false);
    if (ownables.length === 0) return;

    setConfirm({
      severity: "error",
      title: "Confirm delete",
      message: (
        <span>
          Are you sure you want to delete <strong>all Ownables</strong>?
        </span>
      ),
      ok: "Delete all",
      onConfirm: async () => {
        setOwnables([]);
        await ownableService?.deleteAll();
        enqueueSnackbar("All Ownables are deleted");
      },
    });
  };

  const factoryReset = async () => {
    setShowSidebar(false);

    setConfirm({
      severity: "error",
      title: "Factory reset",
      message: (
        <span>
          Are you sure you want to delete all Ownables, all packages and your
          account? <strong>This is a destructive action.</strong>
        </span>
      ),
      ok: "Delete everything",
      onConfirm: async () => {
        setLoaded(false);

        LocalStorageService.clearAll();
        await idb?.deleteAllDatabases();

        window.location.reload();
      },
    });
  };

  // Show loading state while connecting
  if (isConnecting) {
    return (
      <Box className="flex min-h-screen items-center justify-center">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <>
      <AppToolbar
        onMenuClick={() => setShowSidebar(true)}
        onNotificationClick={handleNotificationClick}
        messagesCount={message}
        chainId={chainId}
        isConnected={isConnected}
      />
      {ownables.length === 0 && (
        <div className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center px-4">
          <div className="max-w-2xl text-center">
            <h1 className="text-page-title">
              Let's get started!
            </h1>
            <p
              className="text-body mt-4 text-base sm:text-2xl"
            >
              Read{" "}
              <Link
                href="https://docs.ltonetwork.com/ownables/what-are-ownables"
                target="_blank"
                className={cn(emptyStateLink())}
              >
                the documentation
              </Link>{" "}
              to learn how to issue an Ownable
              {HAS_EXAMPLES && (
                <>
                  <br />
                  or try one of{" "}
                  <Link
                    href="#"
                    onClick={(e) => { e.preventDefault(); setSelectedChainId(ISSUE_OWNABLE_ID); setShowDetail(true); }}
                    className={cn(emptyStateLink())}
                  >
                    the examples
                  </Link>
                </>
              )}
              .
              <br />
            </p>
          </div>
        </div>
      )}

      <Box
        className="mx-auto mt-4 flex max-w-330 gap-4 px-3 pb-6 lg:px-4"
      >
        {/* Left sidebar — ownable list */}
        <Box aria-label="Ownable list" role="navigation" className={cn(listPane({ hiddenOnMobile: showDetail }))}>
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
                      if (chain.id !== consuming.chain.id) {
                        consume(chain, consuming.chain);
                      }
                      return;
                    }
                    setSelectedChainId(chain.id);
                    setShowDetail(true);
                  }}
                />
              );
            })}
          </Box>

          {/* Issue an Ownable — dashed border button */}
          <Button
            type="button"
            onClick={() => {
              if (consuming !== null) return;
              setSelectedChainId(ISSUE_OWNABLE_ID);
              setShowDetail(true);
            }}
            disabled={consuming !== null}
            className={cn(issueOwnableButton({ selected: selectedChainId === ISSUE_OWNABLE_ID, dimmed: consuming !== null }))}
          >
            {/* Icon tile */}
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[14px] bg-linear-to-br from-indigo-100 to-purple-100 transition-all hover:from-indigo-200 hover:to-purple-200 dark:from-indigo-900/30 dark:to-purple-900/30 dark:hover:from-indigo-800/40 dark:hover:to-purple-800/40">
              <Plus className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
            </div>
            {/* Text */}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Issue an Ownable
              </p>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Create a new ownable from a package
              </p>
            </div>
          </Button>
        </Box>

        {/* Right detail panel */}
        {(() => {
          const selectedOwnable = ownables.find(
            ({ chain }) => chain.id === selectedChainId
          );
          return (
            <Box
              aria-label="Ownable detail"
              role="region"
              className={cn(detailPane({ showOnMobile: showDetail }), "lg:block")}
            >
              {/* Back button — mobile only */}
              <Box className="mb-1 block lg:hidden">
                <IconButton
                  aria-label="Back"
                  onClick={() => {
                    setSelectedChainId(null);
                    setShowDetail(false);
                  }}
                >
                  <ArrowBack />
                </IconButton>
              </Box>

              {selectedChainId === ISSUE_OWNABLE_ID && (
                <IssueOwnablePanel
                  onSelect={forge}
                  onImportFR={relayImport}
                  onError={showError}
                  onCreate={() => setShowCreateOwnable(true)}
                  message={message}
                />
              )}

              {selectedChainId !== ISSUE_OWNABLE_ID && selectedOwnable && (
                <Ownable
                  key={selectedOwnable.chain.id}
                  chain={selectedOwnable.chain}
                  packageCid={selectedOwnable.package}
                  uniqueMessageHash={selectedOwnable.uniqueMessageHash}
                  selected={consuming?.chain.id === selectedOwnable.chain.id}
                  onDelete={() =>
                    deleteOwnable(
                      selectedOwnable.chain.id,
                      selectedOwnable.package
                    )
                  }
                  onRemove={() => removeOwnable(selectedOwnable.chain.id)}
                  onConsume={(info) =>
                    setConsuming({
                      chain: selectedOwnable.chain,
                      package: selectedOwnable.package,
                      info,
                    })
                  }
                  onError={showError}
                >
                  {consuming?.chain.id === selectedOwnable.chain.id && (
                    <Overlay zIndex={1000} />
                  )}
                  {consuming !== null &&
                    consuming.chain.id !== selectedOwnable.chain.id && (
                    <Overlay
                      zIndex={1000}
                      disabled={consumeEligibility[selectedOwnable.chain.id] === false}
                      onClick={() =>
                        consume(selectedOwnable.chain, consuming!.chain)
                      }
                    />
                  )}
                </Ownable>
              )}
            </Box>
          );
        })()}
      </Box>

      <Sidebar
        open={showSidebar}
        onClose={() => setShowSidebar(false)}
        onReset={reset}
        onFactoryReset={factoryReset}
      />

      <CreateOwnableDialog
        open={showCreateOwnable}
        onClose={() => setShowCreateOwnable(false)}
        onSuccess={() => {
          setShowCreateOwnable(false);
        }}
      />

      <ViewMessagesBar
        open={showViewMessagesBar}
        onClose={() => setShowViewMessagesBar(false)}
        messagesCount={message}
        setOwnables={setOwnables}
      />

      <LoginDialog key={address} open={showLogin} />

      <HelpDrawer open={consuming !== null}>
        <p className="font-bold">
          Select which Ownable should consume this{" "}
          <em>
            {consuming && packageService
              ? packageService.info(consuming.package).title
              : ""}
          </em>
        </p>
        <Box>
          <Button className="text-white" onClick={() => setConsuming(null)}>
            Cancel
          </Button>
        </Box>
      </HelpDrawer>

      <SnackbarProvider />
      <AlertDialog
        open={alert !== null}
        onClose={() => setAlert(null)}
        {...alert!}
      >
        {alert?.message}
      </AlertDialog>
      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        {...confirm!}
      >
        {confirm?.message}
      </ConfirmDialog>
      <Loading show={(!loaded || isPackageManagerLoading) && !showLogin} />
    </>
  );
}
