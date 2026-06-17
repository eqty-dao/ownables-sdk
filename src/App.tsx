import React, { useEffect, useState } from "react";
import { isE2E } from "@/utils/isE2E";
import { Box } from "@/components/ui";
import LoginDialog from "@/components/LoginDialog";
import AppToolbar from "@/components/AppToolbar";
import { SnackbarProvider } from "notistack";
import { useChainId, useConnect } from "wagmi";
import CreateOwnableDialog from "@/components/CreateOwnableDialog";
import Sidebar from "@/components/Sidebar";
import GetStarted from "@/components/GetStarted";
import OwnableList from "@/components/OwnableList";
import MainSection from "@/components/MainSection";
import ConsumingDrawer from "@/components/ConsumingDrawer";
import useEffectiveWallet from "@/hooks/useEffectiveWallet";
import { useOwnables } from "@/hooks/useOwnables";
import { useConsuming } from "@/hooks/useConsuming";
import { useDialogs } from "@/contexts/Dialogs.context";
import { useService } from "@/hooks/useService";
import useInterval from "@/hooks/useInterval";
import { LoaderCircle } from "lucide-react"
const ISSUE_OWNABLE_ID = "issue";
const EMBEDDED = ['true', 'yes', 'on', '1'].includes(import.meta.env.VITE_EMBEDDED?.toLowerCase() ?? '');

export default function App() {
  const [showSidebar, setShowSidebar] = useState(false);
  const [showCreateOwnable, setShowCreateOwnable] = useState(false);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  const packageService = useService("packages");
  const hub = useService("hub");
  const { showError } = useDialogs();

  const { address, isConnected, isConnecting } = useEffectiveWallet();
  const chainId = useChainId();
  const { error: connectError } = useConnect();
  const [isHubAvailable, setIsHubAvailable] = useState<boolean | null>(null);

  const selectIssuePanel = () => {
    setSelectedEntryId(ISSUE_OWNABLE_ID);
    setShowDetail(true);
  };

  const {
    ownables,
    availableOwnables,
    archivedAvailableOwnables,
    mainListEntries,
    mainListLoaded,
    importingAvailableOwnableId,
    hiddenAvailableOwnablesCount,
    setOwnables,
    forge,
    importAvailableOwnable,
    dismissAvailableOwnable,
    restoreDismissedAvailableOwnable,
    removeOwnable,
    deleteOwnable,
    reset,
    factoryReset,
  } = useOwnables({ onSelect: (id) => { setSelectedEntryId(id); setShowDetail(true); } });

  const { consuming, consumeEligibility, startConsuming, cancelConsuming, consume } =
    useConsuming({ ownables, onConsumed: (id) => setOwnables((prev) => prev.map((o) => o.chain.id === id ? { ...o, isConsumed: true } : o)) });

  useEffect(() => {
    setShowSidebar(false);
    cancelConsuming();
    if (!isConnected) setOwnables([]);
  }, [address, isConnected, chainId]);

  useEffect(() => {
    if (connectError && connectError.name !== "ConnectorAlreadyConnectedError") {
      showError("Connection Error", connectError.message);
    }
  }, [connectError]);

  useEffect(() => {
    let alive = true;

    const checkHub = async () => {
      if (!hub?.isConfigured) {
        if (alive) setIsHubAvailable(null);
        return;
      }

      const available = await hub.isAvailable();
      if (alive) setIsHubAvailable(available);
    };

    void checkHub();

    return () => {
      alive = false;
    };
  }, [hub]);

  useInterval(() => {
    if (!hub?.isConfigured) {
      setIsHubAvailable(null);
      return;
    }

    void hub.isAvailable().then(setIsHubAvailable);
  }, 5000);

  if (isConnecting) {
    return (
      <Box className="flex min-h-screen items-center justify-center">
        <LoaderCircle className="animate-spin" />
      </Box>
    );
  }

  return (
    <>
      {!EMBEDDED && (
        <AppToolbar
          onMenuClick={() => setShowSidebar(true)}
          chainId={chainId}
          isConnected={isConnected}
          isHubAvailable={isHubAvailable}
        />
      )}

      {mainListLoaded && mainListEntries.length === 0 && !showDetail && !EMBEDDED && (
        <GetStarted onExamples={selectIssuePanel} />
      )}

      <Box className="mx-auto lg:mt-4 flex max-w-330 gap-4 lg:pb-6 lg:px-4">
        <OwnableList
          className="mt-4"
          entries={mainListEntries}
          selectedChainId={selectedEntryId}
          issueSelected={selectedEntryId === ISSUE_OWNABLE_ID}
          hiddenOnMobile={showDetail}
          consuming={consuming}
          consumeEligibility={consumeEligibility}
          archivedAvailableOwnables={archivedAvailableOwnables}
          hiddenAvailableOwnablesCount={hiddenAvailableOwnablesCount}
          onSelect={(id) => { setSelectedEntryId(id); setShowDetail(true); }}
          onConsume={consume}
          onIssue={selectIssuePanel}
          onImportAvailable={importAvailableOwnable}
          onRestoreAvailable={restoreDismissedAvailableOwnable}
        />

        <MainSection
          ownables={ownables}
          availableOwnables={availableOwnables}
          selectedEntryId={selectedEntryId}
          showIssuePanel={selectedEntryId === ISSUE_OWNABLE_ID}
          showDetail={showDetail}
          consuming={consuming}
          consumeEligibility={consumeEligibility}
          isHubAvailable={isHubAvailable}
          importingAvailableOwnableId={importingAvailableOwnableId}
          onBack={() => { setSelectedEntryId(null); setShowDetail(false); }}
          onConsume={(info) => {
            const o = ownables.find((ownable) => ownable.chain.id === selectedEntryId);
            if (o) { startConsuming(o.chain, o.package, info); setShowDetail(false); }
          }}
          onConsumeComplete={consume}
          onDelete={deleteOwnable}
          onRemove={removeOwnable}
          onImportAvailable={importAvailableOwnable}
          onArchiveAvailable={(entryId) => {
            dismissAvailableOwnable(entryId);
            if (selectedEntryId === entryId) {
              setSelectedEntryId(null);
              setShowDetail(false);
            }
          }}
          onError={showError}
          onForge={forge}
          onCreate={() => setShowCreateOwnable(true)}
        />
      </Box>

      {!EMBEDDED && (
        <>
          <Sidebar
            open={showSidebar}
            onClose={() => setShowSidebar(false)}
            onReset={() => { setShowSidebar(false); reset(); }}
            onFactoryReset={() => { setShowSidebar(false); factoryReset(); }}
          />

          {!isConnected && !isE2E && <LoginDialog open={true} />}
        </>
      )}

      <CreateOwnableDialog
        open={showCreateOwnable}
        onClose={() => setShowCreateOwnable(false)}
        onSuccess={() => setShowCreateOwnable(false)}
      />

      <ConsumingDrawer
        open={consuming !== null}
        packageTitle={consuming && packageService ? packageService.info(consuming.package).title : ""}
        onCancel={() => { cancelConsuming(); setShowDetail(true); }}
      />

      <SnackbarProvider />
    </>
  );
}
