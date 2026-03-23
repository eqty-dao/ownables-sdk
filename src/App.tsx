import { useEffect, useState } from "react";
import { isE2E } from "./utils/isE2E";
import { AlertColor, Box, Button, CircularProgress } from "@/components/ui";
import LoginDialog from "./components/LoginDialog";
import Loading from "./components/Loading";
import { ViewMessagesBar } from "./components/ViewMessagesBar";
import * as React from "react";
import { EventChain } from "eqty-core";
import AppToolbar from "./components/AppToolbar";
import AlertDialog from "./components/AlertDialog";
import ownableErrorMessage from "./utils/ownableErrorMessage";
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
import Sidebar from "./components/Sidebar";
import GetStarted from "./components/GetStarted";
import OwnableList from "./components/OwnableList";
import OwnableCard from "./components/OwnableCard";
import ConsumingDrawer from "./components/ConsumingDrawer";
import { TypedPackage } from "./interfaces/TypedPackage";

const ISSUE_OWNABLE_ID = "issue";

export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showViewMessagesBar, setShowViewMessagesBar] = useState(false);
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

  const { setMessageCount } = useMessageCount();
  const { address, isConnected, isConnecting } = useAccount();
  const chainId = useChainId();
  const { error: connectError } = useConnect();

  useEffect(() => {
    if (!ownableService) return;
    ownableService.loadAll().then(async (loaded) => {
      setOwnables(loaded);
      await Promise.allSettled(
        loaded.map(({ chain, package: cid }) => ownableService.initWorker(chain.id, cid))
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
    if (!isConnected) setOwnables([]);
  }, [address, isConnected, chainId]);

  useEffect(() => {
    if (connectError && connectError.name !== "ConnectorAlreadyConnectedError") {
      showError("Connection Error", connectError.message);
    }
  }, [connectError]);

  const showError = (title: string, message: string) => {
    setAlert({ severity: "error", title, message });
  };

  const removeOwnable = (ownableId: string) => {
    setOwnables((prev) => prev.filter((o) => o.chain.id !== ownableId));
  };

  const getExplorerUrl = (txHash: string, chainId: number) => {
    switch (chainId) {
      case 84532: return `https://sepolia.basescan.org/tx/${txHash}`;
      case 8453:  return `https://basescan.org/tx/${txHash}`;
      default:    return `https://sepolia.basescan.org/tx/${txHash}`;
    }
  };

  const forge = async (pkg: TypedPackage) => {
    if (!ownableService) throw new Error("Ownable service not ready");
    try {
      const steps = [{ id: "signEvent", label: "Sign the event" }];
      if (ownableService.anchoring) steps.push({ id: "anchorEvent", label: "Anchor the event" });
      const [ctrl, onProgress] = progress.open({ title: `Forging ${pkg.title}`, steps });
      const result = await ownableService.create(pkg, onProgress);
      setOwnables([...ownables, { chain: result.chain, package: pkg.cid }]);
      setSelectedChainId(result.chain.id);
      ctrl.close();

      if (result.txHash) {
        const explorerUrl = getExplorerUrl(result.txHash, chainId);
        enqueueSnackbar(`${pkg.title} forged and anchored! TX: ${result.txHash.slice(0, 10)}...`, {
          variant: "success",
          action: (
            <Button className="text-white hover:bg-white/20" size="small" onClick={() => window.open(explorerUrl, "_blank")}>
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
  };

  const relayImport = async (pkg: TypedPackage[] | null, triggerRefresh: boolean) => {
    if (!pkg || pkg.length === 0) {
      enqueueSnackbar("Nothing to Load from relay", { variant: "error" });
      return;
    }
    try {
      const validPackages = pkg.filter((data) => data.chain && data.cid);
      setOwnables((prevOwnables) => {
        const next = [
          ...prevOwnables,
          ...validPackages.map((data) => ({
            chain: data.chain,
            package: data.cid,
            uniqueMessageHash: data.uniqueMessageHash,
          })),
        ];
        if (!selectedChainId && next.length > 0) setSelectedChainId(next[0].chain.id);
        return next;
      });
      enqueueSnackbar("Ownable successfully loaded", { variant: "success" });
      await setMessageCount(0);
      setMessages(0);
      if (triggerRefresh) {
        setAlert({ severity: "info", title: "New Ownables Detected", message: "New ownables have been detected. Refreshing..." });
        setTimeout(() => window.location.reload(), 7000);
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
      message: <span>Are you sure you want to delete this <em>{pkg.title}</em> Ownable?</span>,
      ok: "Delete",
      onConfirm: async () => {
        if (!ownableService) throw new Error("Ownable service not ready");
        setOwnables((current) => current.filter((o) => o.chain.id !== id));
        ownableService.clearRpc(id);
        await ownableService.delete(id);
        const uniqueMessageHash = pkg.uniqueMessageHash;
        if (pkg.isNotLocal && packageService) {
          const globalStorage = new LocalStorageService();
          globalStorage.removeByField("packages", "uniqueMessageHash", uniqueMessageHash);
        }
        if (uniqueMessageHash) await relayService?.removeOwnable(uniqueMessageHash);
      },
    });
  };

  const canConsume = async (consumer: { chain: EventChain; package: string }): Promise<boolean> => {
    return Boolean(consuming?.info && (await ownableService?.canConsume(consumer, consuming.info)));
  };

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
      { id: "signConsumableEvent", label: "Sign the consumable event" },
      { id: "signConsumerEvent", label: "Sign the consumer event" },
    ];
    if (ownableService.anchoring) steps.push({ id: "anchor", label: "Anchor both events" });
    const [ctrl, onProgress] = progress.open({ title: "Consuming Ownable", steps });
    ownableService
      .consume(consumer, consumable, onProgress)
      .then(() => {
        setConsuming(null);
        setOwnables((ownables) => [...ownables]);
        enqueueSnackbar("Consumed", { variant: "success" });
        ctrl.close();
      })
      .catch((error) => showError("Consume failed", ownableErrorMessage(error)));
  };

  const reset = async () => {
    setShowSidebar(false);
    if (ownables.length === 0) return;
    setConfirm({
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
  };

  const factoryReset = async () => {
    setShowSidebar(false);
    setConfirm({
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
  };

  const selectIssuePanel = () => {
    setSelectedChainId(ISSUE_OWNABLE_ID);
    setShowDetail(true);
  };

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
        onNotificationClick={() => setShowViewMessagesBar(true)}
        messagesCount={message}
        chainId={chainId}
        isConnected={isConnected}
      />

      {ownables.length === 0 && <GetStarted onExamples={selectIssuePanel} />}

      <Box className="mx-auto mt-4 flex max-w-330 gap-4 px-3 pb-6 lg:px-4">
        <OwnableList
          ownables={ownables}
          selectedChainId={selectedChainId}
          issueSelected={selectedChainId === ISSUE_OWNABLE_ID}
          hiddenOnMobile={showDetail}
          consuming={consuming}
          consumeEligibility={consumeEligibility}
          onSelect={(id) => { setSelectedChainId(id); setShowDetail(true); }}
          onConsume={consume}
          onIssue={selectIssuePanel}
        />

        <OwnableCard
          ownables={ownables}
          selectedChainId={selectedChainId}
          showIssuePanel={selectedChainId === ISSUE_OWNABLE_ID}
          showDetail={showDetail}
          consuming={consuming}
          consumeEligibility={consumeEligibility}
          message={message}
          onBack={() => { setSelectedChainId(null); setShowDetail(false); }}
          onConsume={(info) => {
            const o = ownables.find(o => o.chain.id === selectedChainId);
            if (o) setConsuming({ chain: o.chain, package: o.package, info });
          }}
          onConsumeComplete={consume}
          onDelete={deleteOwnable}
          onRemove={removeOwnable}
          onError={showError}
          onForge={forge}
          onImportFR={relayImport}
          onCreate={() => setShowCreateOwnable(true)}
        />
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
        onSuccess={() => setShowCreateOwnable(false)}
      />

      <ViewMessagesBar
        open={showViewMessagesBar}
        onClose={() => setShowViewMessagesBar(false)}
        messagesCount={message}
        setOwnables={setOwnables}
      />

      <LoginDialog key={address} open={showLogin} />

      <ConsumingDrawer
        open={consuming !== null}
        packageTitle={consuming && packageService ? packageService.info(consuming.package).title : ""}
        onCancel={() => setConsuming(null)}
      />

      <SnackbarProvider />
      <AlertDialog open={alert !== null} onClose={() => setAlert(null)} {...alert!}>
        {alert?.message}
      </AlertDialog>
      <ConfirmDialog open={confirm !== null} onClose={() => setConfirm(null)} {...confirm!}>
        {confirm?.message}
      </ConfirmDialog>
      <Loading show={(!loaded || isPackageManagerLoading) && !showLogin} />
    </>
  );
}
