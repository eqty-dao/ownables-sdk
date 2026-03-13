import { useEffect, useState } from "react";
import { Box, Button, CircularProgress, IconButton, Link, Typography } from "@/components/ui/primitives";
import { ArrowLeft as ArrowBack } from "lucide-react";
import PackagesFab from "./components/PackagesFab";
import { TypedPackage } from "./interfaces/TypedPackage";
import LoginDialog from "./components/LoginDialog";
import Loading from "./components/Loading";
import Sidebar from "./components/Sidebar";
import { ViewMessagesBar } from "./components/ViewMessagesBar";
import If from "./components/If";
import { HAS_EXAMPLES } from "./services/Package.service";
import Grid from "@/components/ui/primitives/Grid";
import * as React from "react";
import Ownable from "./components/Ownable";
import OwnableListItem from "./components/OwnableListItem";
import { EventChain } from "eqty-core";
import HelpDrawer from "./components/HelpDrawer";
import AppToolbar from "./components/AppToolbar";
import AlertDialog from "./components/AlertDialog";
import { AlertColor } from "@/components/ui/primitives/Alert/Alert";
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
import { cn } from "./components/ui/lib/cn";

const listPane = cva(
  "w-full flex-shrink-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:w-[360px]",
  {
    variants: {
      hiddenOnMobile: {
        true: "hidden md:block",
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

export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showViewMessagesBar, setShowViewMessagesBar] = useState(false);
  const [showPackages, setShowPackages] = React.useState(false);
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

    ownableService.loadAll().then((loaded) => {
      setOwnables(loaded);
      if (loaded.length > 0) setSelectedChainId(loaded[0].chain.id);
      setLoaded(true);
    });
  }, [ownableService]);

  const isE2E = import.meta.env.VITE_E2E === "true";

  useEffect(() => {
    setShowLogin(!isConnected && !isE2E);

    setShowSidebar(false);
    setShowViewMessagesBar(false);
    setShowPackages(false);
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
      setShowPackages(false);
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
                color="inherit"
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
    try {
      return Boolean(
        consuming?.info &&
          (await ownableService?.canConsume(consumer, consuming!.info))
      );
    } catch (e) {
      console.error(e, (e as any).cause);
      return false;
    }
  };

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
      <If condition={ownables.length === 0}>
        <Grid
          container
          className="pointer-events-none absolute inset-0 -z-10 place-items-center px-4"
        >
          <Grid className="max-w-2xl text-center">
            <Typography
              component="h1"
              className="text-4xl font-semibold text-slate-900 sm:text-5xl"
            >
              Let's get started!
            </Typography>
            <Typography
              className="mt-4 text-base text-slate-600 sm:text-2xl"
            >
              Read{" "}
              <Link
                href="https://docs.ltonetwork.com/ownables/what-are-ownables"
                target="_blank"
                className="pointer-events-auto text-indigo-600 underline"
              >
                the documentation
              </Link>{" "}
              to learn how to issue an Ownable
              <If condition={HAS_EXAMPLES}>
                <br />
                or try one of{" "}
                <Link
                  component="button"
                  onClick={() => setShowPackages(true)}
                  className="pointer-events-auto text-indigo-600 underline"
                >
                  the examples
                </Link>
              </If>
              .
              <br />
            </Typography>
          </Grid>
        </Grid>
      </If>

      <Box
        className="mx-auto mt-4 flex max-w-[1320px] gap-4 px-3 pb-6 md:px-4"
      >
        {/* Left sidebar — ownable list */}
        <Box
          component="nav"
          aria-label="Ownable list"
          className={cn(listPane({ hiddenOnMobile: showDetail }))}
        >
          <Box className="space-y-2">
            {ownables.map(({ chain, package: packageCid, uniqueMessageHash }) => {
              const pkg = packageService?.info(packageCid, uniqueMessageHash);
              return (
                <OwnableListItem
                  key={chain.id}
                  chain={chain}
                  packageCid={packageCid}
                  metadata={{ name: pkg?.title ?? "", description: pkg?.description }}
                  isConsumable={!!(pkg?.isConsumable)}
                  isSelected={selectedChainId === chain.id}
                  onClick={() => {
                    setSelectedChainId(chain.id);
                    setShowDetail(true);
                  }}
                />
              );
            })}
          </Box>

          {/* Issue an Ownable — dashed border button */}
          <button
            type="button"
            onClick={() => setShowPackages(true)}
            className="mt-3 flex w-full items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-600 hover:border-indigo-400 hover:text-indigo-600"
          >
            + Issue an Ownable
          </button>
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
              className={cn(detailPane({ showOnMobile: showDetail }), "md:block")}
            >
              {/* Back button — mobile only */}
              <Box className="mb-1 block md:hidden">
                <IconButton
                  aria-label="Back"
                  onClick={() => setShowDetail(false)}
                >
                  <ArrowBack />
                </IconButton>
              </Box>

              {selectedOwnable && (
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
                  <If
                    condition={
                      consuming?.chain.id === selectedOwnable.chain.id
                    }
                  >
                    <Overlay zIndex={1000} />
                  </If>
                  <If
                    condition={
                      consuming !== null &&
                      consuming.chain.id !== selectedOwnable.chain.id
                    }
                  >
                    <Overlay
                      zIndex={1000}
                      disabled={canConsume({
                        chain: selectedOwnable.chain,
                        package: selectedOwnable.package,
                      }).then((can) => !can)}
                      onClick={() =>
                        consume(selectedOwnable.chain, consuming!.chain)
                      }
                    />
                  </If>
                </Ownable>
              )}
            </Box>
          );
        })()}
      </Box>

      <PackagesFab
        open={showPackages}
        onOpen={() => setShowPackages(true)}
        onClose={() => setShowPackages(false)}
        onSelect={forge}
        onImportFR={relayImport}
        onError={showError}
        onCreate={() => setShowCreateOwnable(true)}
        message={message}
      />

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
          setShowPackages(false);
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
        <Typography component="span" sx={{ fontWeight: 700 }}>
          Select which Ownable should consume this{" "}
          <em>
            {consuming && packageService
              ? packageService.info(consuming.package).title
              : ""}
          </em>
        </Typography>
        <Box>
          <Button
            sx={(theme) => ({ color: theme.palette.primary.contrastText })}
            onClick={() => setConsuming(null)}
          >
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
