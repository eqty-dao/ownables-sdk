import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EventChain } from "eqty-core";
import { StateDump } from "@/services/Ownable.service";
import { TypedMetadata, TypedOwnableInfo } from "@/interfaces/TypedOwnableInfo";
import { TypedPackage } from "@/interfaces/TypedPackage";
import TypedDict from "@/interfaces/TypedDict";
import isObject from "@/utils/isObject";
import ownableErrorMessage from "@/utils/ownableErrorMessage";
import { useService } from "./useService";
import { useAccount } from "wagmi";
import { useProgress, LogProgress } from "@/contexts/Progress.context";

export function useOwnableState(
  chain: EventChain,
  pkg: TypedPackage | undefined,
  onError: (title: string, message: string) => void
) {
  const ownables = useService("ownables");
  const eventChains = useService("eventChains");
  const eqty = useService("eqty");
  const { address: liveAddress } = useAccount();
  const progress = useProgress();

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const busyRef = useRef(false);

  const [initialized, setInitialized] = useState(false);
  const [applied, setApplied] = useState<any>(new EventChain(chain.id).latestHash);
  const [stateDump, setStateDump] = useState<StateDump>([]);
  const [info, setInfo] = useState<TypedOwnableInfo | undefined>(undefined);
  const [metadata, setMetadata] = useState<TypedMetadata>({
    name: pkg?.title ?? "",
    description: pkg?.description,
  });
  const [isConsumed, setIsConsumed] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (pkg) setMetadata({ name: pkg.title, description: pkg.description });
  }, [pkg]);

  const effectiveAddress = (eqty?.address || liveAddress || "").toLowerCase();
  const ownerAddress = (info?.owner || "").toLowerCase();
  const isTransferred = useMemo(
    () => ownerAddress !== "" && effectiveAddress !== "" && ownerAddress !== effectiveAddress,
    [ownerAddress, effectiveAddress]
  );

  const refresh = useCallback(
    async (sd?: StateDump): Promise<void> => {
      if (!ownables || !pkg || !ownables.isReady(chain.id)) return;
      const effective = sd ?? stateDump;

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
      if (!ownables || !eventChains || busyRef.current || !ownables.isReady(chain.id)) return;

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
        onError("Failed to apply chain", ownableErrorMessage(e as Error));
      } finally {
        busyRef.current = false;
        setIsApplying(false);
      }
    },
    [chain.id, chain.latestHash, eventChains, ownables, onError, refresh, stateDump]
  );

  const execute = useCallback(
    async (msg: TypedDict, onProgress?: LogProgress, submitAnchors = true): Promise<void> => {
      if (!ownables) return;
      try {
        const sd = await ownables.execute(chain, msg, stateDump, onProgress);
        if (submitAnchors) await ownables.submitAnchors(onProgress);

        await refresh(sd);
        setApplied(chain.latestHash);
        setStateDump(sd);
      } catch (e) {
        onError("The Ownable returned an error", ownableErrorMessage(e));
      }
    },
    [chain, ownables, onError, refresh, stateDump]
  );

  const onLoad = useCallback(async (): Promise<void> => {
    if (!ownables || !pkg) return;

    if (!pkg.isDynamic) {
      await ownables.initStore(chain, pkg.cid, pkg.uniqueMessageHash);
      return;
    }

    try {
      ownables.setWidgetWindow(chain.id, iframeRef.current?.contentWindow ?? null);
      await ownables.init(chain, pkg.cid, pkg.uniqueMessageHash);
      setInitialized(true);
    } catch (e) {
      onError("Failed to forge Ownable", ownableErrorMessage(e));
    }
  }, [chain, ownables, pkg, onError]);

  // Window message handler for widget-triggered execute calls
  const windowMessageHandler = useCallback(
    async (event: MessageEvent) => {
      if (!isObject(event.data) || !("ownable_id" in event.data) || event.data.ownable_id !== chain.id) return;
      if (iframeRef.current?.contentWindow !== event.source)
        throw Error("Not allowed to execute msg on other Ownable");

      const steps = [{ id: "signEvent", label: "Sign the event" }];
      if (ownables?.anchoring) steps.push({ id: "anchor", label: "Anchor the event" });

      try {
        const [ctrl, onProgress] = progress.open({ title: "Processing action", steps });
        await execute(event.data.msg, onProgress);
        ctrl.close();
      } catch (e) {
        console.error("Widget action failed", e);
      }
    },
    [chain.id, execute, progress, ownables]
  );

  useEffect(() => {
    window.addEventListener("message", windowMessageHandler);
    return () => window.removeEventListener("message", windowMessageHandler);
  }, [windowMessageHandler]);

  // Unregister widget window on unmount
  useEffect(() => {
    return () => { ownables?.setWidgetWindow(chain.id, null); };
  }, [chain.id, ownables]);

  // Apply pending chain events and refresh
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
    } else if (initialized !== prev.current.initialized || applied.hex !== prev.current.appliedHex) {
      refresh().then();
    }
    prev.current = { initialized, appliedHex: applied.hex };
  // chainLatestHex ensures re-run when chain is mutated externally
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apply, applied, chainLatestHex, error, initialized, isApplying, refresh]);

  return { iframeRef, info, metadata, isConsumed, isTransferred, isApplying, execute, onLoad };
}
