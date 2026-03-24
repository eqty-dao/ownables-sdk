import { useMemo } from "react";
import { EventChain } from "eqty-core";
import { TypedOwnableInfo } from "@/interfaces/TypedOwnableInfo";
import { TypedPackage } from "@/interfaces/TypedPackage";
import { useService } from "@/hooks/useService";
import { useOwnableState } from "@/hooks/useOwnableState";
import { useOwnableTransfer } from "@/hooks/useOwnableTransfer";
import OwnableDetail from "./OwnableDetail";

interface OwnableProps {
  chain: EventChain;
  packageCid: string;
  selected: boolean;
  uniqueMessageHash?: string;
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
  const relay = useService("relay");

  const pkg: TypedPackage | undefined = useMemo(() => {
    if (!packages) return undefined;
    return packages.info(packageCid, uniqueMessageHash);
  }, [packages, packageCid, uniqueMessageHash]);

  const { iframeRef, info, metadata, isConsumed, isLocked, isTransferred, execute, onLoad } =
    useOwnableState(chain, pkg, props.onError);

  const { transfer } = useOwnableTransfer(chain, pkg, execute);

  if (!ownables || !packages || !idb || !eventChains || !relay || !pkg) return <></>;

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
      iframeRef={iframeRef}
      onBack={props.onBack}
      onLoad={() => onLoad()}
      onConsume={() => !!info && props.onConsume(info)}
      onDelete={props.onDelete}
      onTransfer={(address) => transfer(address)}
    />
  );
}
