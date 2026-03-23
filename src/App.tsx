import { useEffect, useState } from "react";
import { isE2E } from "./utils/isE2E";
import { Box, CircularProgress } from "@/components/ui";
import LoginDialog from "./components/LoginDialog";
import Loading from "./components/Loading";
import { ViewMessagesBar } from "./components/ViewMessagesBar";
import AppToolbar from "./components/AppToolbar";
import { SnackbarProvider } from "notistack";
import { usePackageManager } from "./hooks/usePackageManager";
import { useAccount, useChainId, useConnect } from "wagmi";
import { useMessageCount } from "./hooks/useMessageCount";
import CreateOwnableDialog from "./components/CreateOwnableDialog";
import Sidebar from "./components/Sidebar";
import GetStarted from "./components/GetStarted";
import OwnableList from "./components/OwnableList";
import OwnableCard from "./components/OwnableCard";
import ConsumingDrawer from "./components/ConsumingDrawer";
import { useOwnables } from "./hooks/useOwnables";
import { useConsuming } from "./hooks/useConsuming";
import { useDialogs } from "./contexts/Dialogs.context";
import { useService } from "./hooks/useService";
const ISSUE_OWNABLE_ID = "issue";

export default function App() {
  const [showLogin, setShowLogin] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showViewMessagesBar, setShowViewMessagesBar] = useState(false);
  const [showCreateOwnable, setShowCreateOwnable] = useState(false);
  const [message, setMessages] = useState(0);
  const [selectedChainId, setSelectedChainId] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  const packageService = useService("packages");
  const { isLoading: isPackageManagerLoading } = usePackageManager();
  const { setMessageCount } = useMessageCount();
  const { showError } = useDialogs();

  const { address, isConnected, isConnecting } = useAccount();
  const chainId = useChainId();
  const { error: connectError } = useConnect();

  const selectIssuePanel = () => {
    setSelectedChainId(ISSUE_OWNABLE_ID);
    setShowDetail(true);
  };

  const { ownables, setOwnables, loaded, forge, relayImport, removeOwnable, deleteOwnable, reset, factoryReset } =
    useOwnables({ onSelect: (id) => { setSelectedChainId(id); setShowDetail(true); } });

  const { consuming, consumeEligibility, startConsuming, cancelConsuming, consume } =
    useConsuming({ ownables, onConsumed: () => setOwnables((prev) => [...prev]) });

  useEffect(() => {
    setShowLogin(!isConnected && !isE2E);
    setShowSidebar(false);
    setShowViewMessagesBar(false);
    cancelConsuming();
    if (!isConnected) setOwnables([]);
  }, [address, isConnected, chainId]);

  useEffect(() => {
    if (connectError && connectError.name !== "ConnectorAlreadyConnectedError") {
      showError("Connection Error", connectError.message);
    }
  }, [connectError]);

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
            const o = ownables.find((o) => o.chain.id === selectedChainId);
            if (o) startConsuming(o.chain, o.package, info);
          }}
          onConsumeComplete={consume}
          onDelete={deleteOwnable}
          onRemove={removeOwnable}
          onError={showError}
          onForge={forge}
          onImportFR={async (pkg, refresh) => {
            await relayImport(pkg, refresh);
            await setMessageCount(0);
            setMessages(0);
          }}
          onCreate={() => setShowCreateOwnable(true)}
        />
      </Box>

      <Sidebar
        open={showSidebar}
        onClose={() => setShowSidebar(false)}
        onReset={() => { setShowSidebar(false); reset(); }}
        onFactoryReset={() => { setShowSidebar(false); factoryReset(); }}
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
        onCancel={cancelConsuming}
      />

      <SnackbarProvider />
      <Loading show={(!loaded || isPackageManagerLoading) && !showLogin} />
    </>
  );
}
