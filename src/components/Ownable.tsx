import {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Binary, EventChain, IMessageMeta } from "eqty-core";
import { StateDump } from "../services/Ownable.service";
import {
  TypedMetadata,
  TypedOwnableInfo,
} from "../interfaces/TypedOwnableInfo";
import isObject from "../utils/isObject";
import ownableErrorMessage from "../utils/ownableErrorMessage";
import TypedDict from "../interfaces/TypedDict";
import { TypedPackage } from "../interfaces/TypedPackage";
import { enqueueSnackbar } from "notistack";
import { PACKAGE_TYPE } from "../constants";
import { useService } from "../hooks/useService";
import { useAccount } from "wagmi";
import { useProgress, LogProgress } from "../contexts/Progress.context";
import OwnableDetail from "./OwnableDetail";

interface OwnableProps {
  chain: EventChain;
  packageCid: string;
  selected: boolean;
  uniqueMessageHash?: string;
  onDelete: () => void;
  onConsume: (info: TypedOwnableInfo) => void;
  onRemove: () => void;
  onError: (title: string, message: string) => void;
  children?: ReactNode;
}

export default function Ownable(props: OwnableProps) {
  const { chain, packageCid, uniqueMessageHash, selected, children } = props;

  const ownables = useService("ownables");
  const packages = useService("packages");
  const idb = useService("idb");
  const eventChains = useService("eventChains");
  const relay = useService("relay");
  const eqty = useService("eqty");
  const { address: liveAddress } = useAccount();
  const progress = useProgress();

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const busyRef = useRef(false);

  const pkg: TypedPackage | undefined = useMemo(() => {
    if (!packages) return undefined;
    return packages.info(packageCid, uniqueMessageHash);
  }, [packages, packageCid, uniqueMessageHash]);

  const [initialized, setInitialized] = useState(false);
  const [applied, setApplied] = useState<any>(
    new EventChain(chain.id).latestHash
  );
  const [stateDump, setStateDump] = useState<StateDump>([]);
  const [info, setInfo] = useState<TypedOwnableInfo | undefined>(undefined);
  const [metadata, setMetadata] = useState<TypedMetadata>({
    name: pkg?.title ?? "",
    description: pkg?.description,
  });
  const [isConsumed, setIsConsumed] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  // Keep metadata in sync once pkg becomes available
  useEffect(() => {
    if (pkg) {
      setMetadata({ name: pkg.title, description: pkg.description });
    }
  }, [pkg]);

  const effectiveAddress = (eqty?.address || liveAddress || "").toLowerCase();
  const ownerAddress = (info?.owner || "").toLowerCase();
  const isTransferred =
    ownerAddress !== "" &&
    effectiveAddress !== "" &&
    ownerAddress !== effectiveAddress;

  const resizeToThumbnail = useCallback(async (file: File): Promise<Blob> => {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = URL.createObjectURL(file);
    });

    const canvas = document.createElement("canvas");
    canvas.width = 50;
    canvas.height = 50;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to get canvas context");

    ctx.drawImage(img, 0, 0, 50, 50);

    const quality = 0.8;
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", quality)
    );

    if (!blob) throw new Error("Failed to create thumbnail blob");
    if (blob.size > 256 * 1024)
      throw new Error("Compressed thumbnail still exceeds 256KB");
    return blob;
  }, []);

  const constructMeta = useCallback(async (): Promise<
    Partial<IMessageMeta>
  > => {
    if (!pkg) return {};
    const title = pkg.title;
    const description = pkg.description ?? "";
    const type = PACKAGE_TYPE;

    let thumbnail: Binary | undefined;

    try {
      // Access the global IDB database where packages are stored
      const globalIdb = await import("../services/IDB.service").then((m) =>
        m.default.main()
      );
      const thumbnailFile = await globalIdb.get(
        `package:${pkg.cid}`,
        "thumbnail.webp"
      );

      if (thumbnailFile) {
        const resizedFile = await resizeToThumbnail(thumbnailFile);
        const buffer = await resizedFile.arrayBuffer();
        thumbnail = Binary.from(new Uint8Array(buffer));
      }
    } catch (error) {
      console.warn("Failed to get thumbnail for package:", error);
      // Continue without thumbnail
    }

    return { type, title, description, thumbnail: thumbnail?.base64 };
  }, [pkg, resizeToThumbnail]);

  const refresh = useCallback(
    async (sd?: StateDump): Promise<void> => {
      if (!ownables || !pkg || !ownables.isReady(chain.id)) return;
      let effective = sd ?? stateDump;

      if (pkg.hasWidgetState) await ownables.rpc(chain.id).refresh(effective);

      const infoResp = (await ownables
        .rpc(chain.id)
        .query({ get_info: {} }, effective)) as TypedOwnableInfo;

      const metadataResp = pkg.hasMetadata
        ? ((await ownables
            .rpc(chain.id)
            .query({ get_metadata: {} }, effective)) as TypedMetadata)
        : metadata;

      const consumed = pkg.isConsumable
        ? await ownables.rpc(chain.id).query({ is_consumed: {} }, effective).catch(() => false) as boolean
        : false;
      setInfo(infoResp);
      setMetadata(metadataResp);
      setIsConsumed(consumed);
    },
    [chain.id, metadata, ownables, pkg, stateDump]
  );

  const apply = useCallback(
    async (partialChain: EventChain): Promise<void> => {
      if (
        !ownables ||
        !eventChains ||
        busyRef.current ||
        !ownables.isReady(chain.id)
      )
        return;

      busyRef.current = true;
      setIsApplying(true);

      try {
        const sd =
          (await eventChains.getStateDump(chain.id, partialChain.state.hex)) ||
          (await ownables.apply(partialChain, stateDump));

        await refresh(sd);
        setApplied(chain.latestHash);
        setStateDump(sd);
      } catch (e) {
        console.error("Error applying chain:", e);
        props.onError("Failed to apply chain", ownableErrorMessage(e as Error));
      } finally {
        busyRef.current = false;
        setIsApplying(false);
      }
    },
    [
      chain.id,
      chain.latestHash,
      eventChains,
      ownables,
      props,
      refresh,
      stateDump,
    ]
  );

  const execute = useCallback(
    async (msg: TypedDict, onProgress?: LogProgress, submitAnchors: boolean = true): Promise<void> => {
      if (!ownables) return;
      try {
        const sd = await ownables.execute(chain, msg, stateDump, onProgress);
        if (submitAnchors) await ownables.submitAnchors(onProgress);

        await refresh(sd);
        setApplied(chain.latestHash);
        setStateDump(sd);
      } catch (e) {
        props.onError("The Ownable returned an error", ownableErrorMessage(e));
      }
    },
    [chain, ownables, props, refresh, stateDump]
  );

  const onLoad = useCallback(async (): Promise<void> => {
    if (!ownables || !pkg) return;

    if (!pkg.isDynamic) {
      await ownables.initStore(chain, pkg.cid, pkg.uniqueMessageHash);
      return;
    }

    try {
      ownables.setWidgetWindow(chain.id, iframeRef.current?.contentWindow ?? null);
      await ownables.init(chain, pkg.cid, uniqueMessageHash);
      setInitialized(true);
    } catch (e) {
      props.onError("Failed to forge Ownable", ownableErrorMessage(e));
    }
  }, [chain, ownables, pkg, props, uniqueMessageHash]);

  const windowMessageHandler = useCallback(
    async (event: MessageEvent) => {
      if (
        !isObject(event.data) ||
        !("ownable_id" in event.data) ||
        event.data.ownable_id !== chain.id
      )
        return;
      if (iframeRef.current?.contentWindow !== event.source)
        throw Error("Not allowed to execute msg on other Ownable");

      // Open a progress modal for widget-triggered events (execute)
      const steps = [] as Array<{ id: string; label: string }>;
      steps.push({ id: 'signEvent', label: 'Sign the event' });
      if (ownables?.anchoring) steps.push({ id: 'anchor', label: 'Anchor the event' });

      try {
        const [ctrl, onProgress] = progress.open({ title: 'Processing action', steps });
        await execute(event.data.msg, onProgress);
        ctrl.close();
      } catch (e) {
        // Leave modal open in error state; user can close it
        console.error('Widget action failed', e);
      }
    },
    [chain.id, execute, progress, ownables]
  );

  async function transfer(to: string): Promise<void> {
    if (!relay || !ownables || !pkg) return;

    const available = await relay.isAvailable();
    if (!available) {
      enqueueSnackbar('Relay server is down', { variant: 'error' });
      return;
    }

    const steps = [] as Array<{ id: string; label: string }>;
    steps.push({ id: 'signEvent', label: 'Sign the event' });
    steps.push({ id: 'signMessage', label: 'Sign the Relay message' });
    if (ownables.anchoring) steps.push({ id: 'anchor', label: 'Anchor the event & Relay message' });

    // progress controls available from top-level hook
    try {
      const [ctrl, onProgress] = progress.open({ title: 'Transferring Ownable', steps});

      // Step 1: Execute ownable action (triggers wallet signature)
      await execute({ transfer: { to } }, onProgress, false);

      // Create the zip package
      const zip = await ownables.zip(chain);
      const content = await zip.generateAsync({ type: 'uint8array' });

      // Construct metadata
      const meta = await constructMeta();

      // Send via relay
      await relay.sendOwnable(to, content, meta, ownables.anchoring, onProgress);

      // Submit anchors (if any)
      await ownables.submitAnchors(onProgress);

      enqueueSnackbar(`Ownable sent and anchored successfully!`, {
        variant: 'success',
      });

      ctrl.close();

      // Clean up local ownable if it was imported from relay
      if (pkg.uniqueMessageHash) {
        await relay.removeOwnable(pkg.uniqueMessageHash);
        await ownables.delete(chain.id);
      }
    } catch (error) {
      console.error('Error during transfer:', error);
      enqueueSnackbar(
        `Transfer failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { variant: 'error' }
      );
    }
  }

  // Lifecycle: subscribe to window messages
  useEffect(() => {
    window.addEventListener("message", windowMessageHandler);
    return () => window.removeEventListener("message", windowMessageHandler);
  }, [windowMessageHandler]);

  // Unregister widget window on unmount (worker stays alive for canConsume checks)
  useEffect(() => {
    return () => {
      ownables?.setWidgetWindow(chain.id, null);
    };
  }, [chain.id, ownables]);

  // Effect for applying partial chains and refreshing
  const chainLatestHex = chain.latestHash.hex;
  const prev = useRef({ initialized, appliedHex: applied.hex });
  useEffect(() => {
    if (isApplying || error) return;

    const partial = chain.startingAfter(applied);
    if (partial.events.length > 0) {
      apply(partial).catch((e) => {
        console.error("Error applying chain:", e);
        setError(ownableErrorMessage(e as Error));
      });
    } else if (
      initialized !== prev.current.initialized ||
      applied.hex !== prev.current.appliedHex
    ) {
      refresh().then();
    }
    prev.current = { initialized, appliedHex: applied.hex };
  // chainLatestHex ensures the effect re-runs when the chain is mutated externally
  // (e.g. after a consume operation mutates the chain in-place)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apply, applied, chainLatestHex, error, initialized, isApplying, refresh]);

  // If services or package not ready yet, don't render
  if (!ownables || !packages || !idb || !eventChains || !relay || !pkg)
    return <></>;

  return (
    <OwnableDetail
      chain={chain}
      pkg={pkg}
      metadata={metadata}
      issuer={info?.issuer}
      isConsumable={pkg.isConsumable && !isTransferred && !isConsumed}
      isConsumed={isConsumed}
      isTransferred={isTransferred}
      iframeRef={iframeRef}
      isApplying={isApplying}
      onLoad={() => onLoad()}
      onConsume={() => !!info && props.onConsume(info)}
      onDelete={props.onDelete}
      onTransfer={(address) => transfer(address)}
    >
      {children}
    </OwnableDetail>
  );
}
