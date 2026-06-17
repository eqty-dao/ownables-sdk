import { useCallback, useMemo } from "react";
import { EventChain } from "eqty-core";
import { TypedOwnableInfo } from "@/interfaces/TypedOwnableInfo";
import { TypedPackage } from "@/interfaces/TypedPackage";
import { useService } from "@/hooks/useService";
import { useOwnableState } from "@/hooks/useOwnableState";
import { useOwnableTransfer } from "@/hooks/useOwnableTransfer";
import { useDialogs } from "@/contexts/Dialogs.context";
import OwnableDetail from "./OwnableDetail";

interface OwnableProps {
  chain: EventChain;
  packageCid: string;
  selected: boolean;
  uniqueMessageHash?: string;
  isHubAvailable?: boolean;
  onBack: () => void;
  onDelete: () => void;
  onConsume: (info: TypedOwnableInfo) => void;
  onRemove: () => void;
  onError: (title: string, message: string) => void;
}

export default function Ownable(props: OwnableProps) {
  const { chain, packageCid, uniqueMessageHash } = props;

  const packages = useService("packages");
  const idb = useService("idb");
  const ownables = useService("ownables");
  const eventChains = useService("eventChains");

  const pkg: TypedPackage | undefined = useMemo(() => {
    if (!packages) return undefined;
    return packages.info(packageCid, uniqueMessageHash);
  }, [packages, packageCid, uniqueMessageHash]);

  const { iframeRef, info, metadata, isConsumed, isLocked, isTransferred, execute, onLoad } =
    useOwnableState(chain, pkg, props.onError);

  const { transfer } = useOwnableTransfer(chain, pkg, execute);
  const { showConfirm } = useDialogs();

  const onLock = useCallback(() => {
    showConfirm({
      title: "Lock Ownable",
      message: <span>Are you sure you want to lock this <em>{pkg?.title}</em>?</span>,
      ok: "Lock",
      onConfirm: () => execute({ lock: {} }),
    });
  }, [pkg, execute, showConfirm]);

  const onUnlock = useCallback(() => {
    execute({ unlock: {} });
  }, [execute]);

  if (!ownables || !packages || !idb || !eventChains || !pkg) return <></>;

  return (
    <OwnableDetail
      chain={chain}
      pkg={pkg}
      metadata={metadata}
      issuer={info?.issuer}
      isConsumable={pkg.isConsumable}
      isConsumed={isConsumed}
      isLockable={pkg.isLockable}
      isLocked={isLocked}
      isTransferred={isTransferred}
      isHubAvailable={props.isHubAvailable}
      iframeRef={iframeRef}
      onBack={props.onBack}
      onLoad={() => onLoad()}
      onConsume={() => !!info && props.onConsume(info)}
      onDelete={props.onDelete}
      onTransfer={(address) => transfer(address)}
      onLock={onLock}
      onUnlock={onUnlock}
    />
  );
}
