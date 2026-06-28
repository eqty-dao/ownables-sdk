import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EventChain } from "eqty-core";
import type { StateDump } from "@ownables/core";
import type { TypedAttachment } from "@/interfaces/TypedAttachment";
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
  onError: (title: string, message: string) => void,
  archived = false
) {
  const ownables = useService("ownables");
  const eventChains = useService("eventChains");
  const eqty = useService("eqty");
  const { address: liveAddress } = useAccount();
  const progress = useProgress();

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const busyRef = useRef(false);
  const appliedRef = useRef<any>(new EventChain(chain.id).latestHash);

  const [initialized, setInitialized] = useState(false);
  const [applied, setApplied] = useState<any>(appliedRef.current);
  const [stateDump, setStateDump] = useState<StateDump>([]);
  const [info, setInfo] = useState<TypedOwnableInfo | undefined>(undefined);
  const [metadata, setMetadata] = useState<TypedMetadata>({
    name: pkg?.title ?? "",
    description: pkg?.description,
  });
  const [attachments, setAttachments] = useState<TypedAttachment[]>([]);
  const [isConsumed, setIsConsumed] = useState(false);
  const [isClosed, setIsClosed] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (pkg) setMetadata({ name: pkg.title, description: pkg.description });
  }, [pkg]);

  useEffect(() => {
    appliedRef.current = applied;
  }, [applied]);

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

      const locked = pkg.isLockable
        ? await ownables.rpc(chain.id).query({ is_locked: {} }, effective).catch(() => false) as boolean
        : false;

      const closed = pkg.isClosable
        ? await ownables.rpc(chain.id).query({ is_closed: {} }, effective).catch(() => false) as boolean
        : false;

      const attachmentRows = pkg.hasAttachments
        ? await ownables
            .rpc(chain.id)
            .query({ get_attachments: {} }, effective)
            .then((result) => (result as { attachments?: TypedAttachment[] }).attachments ?? [])
            .catch(() => [])
        : [];

      setInfo(infoResp);
      setMetadata(metadataResp);
      setAttachments(attachmentRows);
      setIsConsumed(consumed);
      setIsClosed(closed);
      setIsLocked(locked);
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
        appliedRef.current = chain.latestHash;
        setApplied(chain.latestHash);
        setStateDump(sd);
      } catch (e) {
        console.error("Error applying chain:", e);
        setError(ownableErrorMessage(e as Error));
        onError("Failed to apply chain", ownableErrorMessage(e as Error));
      } finally {
        busyRef.current = false;
        setIsApplying(false);
      }
    },
    [chain.id, eventChains, ownables, onError, refresh, stateDump]
  );

  const execute = useCallback(
    async (
      msg: TypedDict,
      onProgress?: LogProgress,
      submitAnchors = true,
      eventAttachments: Array<{ name: string; file: File }> = []
    ): Promise<void> => {
      if (!ownables) return;
      if (archived) {
        const message = "Archived ownables are read-only";
        onError("Interaction unavailable", message);
        throw new Error(message);
      }
      try {
        setIsExecuting(true);
        const sd = await ownables.execute(
          chain,
          msg,
          stateDump,
          onProgress as any,
          eventAttachments
        );
        if (submitAnchors) await ownables.submitAnchors(onProgress as any);

        const persistedStateDump = await eventChains?.getStateDump(
          chain.id,
          chain.state.hex
        );
        const nextStateDump = persistedStateDump ?? sd;

        await refresh(nextStateDump);
        appliedRef.current = chain.latestHash;
        setApplied(chain.latestHash);
        setStateDump(nextStateDump);
      } catch (e) {
        onError("The Ownable returned an error", ownableErrorMessage(e));
        throw e;
      } finally {
        setIsExecuting(false);
      }
    },
    [archived, chain, eventChains, ownables, onError, refresh, stateDump]
  );

  const onLoad = useCallback(async (): Promise<void> => {
    if (!ownables || !pkg || initialized) return;

    if (!pkg.isDynamic) {
      await ownables.initStore(chain, pkg.cid, pkg.uniqueMessageHash);
      return;
    }

    try {
      await ownables.init(chain, pkg.cid, pkg.uniqueMessageHash);
      ownables.setWidgetWindow(chain.id, archived ? null : iframeRef.current?.contentWindow ?? null);
      if (eventChains) {
        const nextStateDump = await eventChains.getStateDump(chain.id, chain.state.hex);
        if (nextStateDump) {
          setStateDump(nextStateDump);
          appliedRef.current = chain.latestHash;
          setApplied(chain.latestHash);
          await refresh(nextStateDump);
        }
      }
      setInitialized(true);
    } catch (e) {
      onError("Failed to forge Ownable", ownableErrorMessage(e));
    }
  }, [archived, chain, eventChains, initialized, ownables, pkg, onError, refresh]);

  // Window message handler for widget-triggered execute calls
  const windowMessageHandler = useCallback(
    async (event: MessageEvent) => {
      if (!isObject(event.data) || !("ownable_id" in event.data) || event.data.ownable_id !== chain.id) return;
      if (iframeRef.current?.contentWindow !== event.source)
        throw Error("Not allowed to execute msg on other Ownable");
      if (archived) {
        onError("Interaction unavailable", "Archived ownables are read-only");
        return;
      }

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
    [archived, chain.id, execute, progress, ownables, onError]
  );

  useEffect(() => {
    window.addEventListener("message", windowMessageHandler);
    return () => window.removeEventListener("message", windowMessageHandler);
  }, [windowMessageHandler]);

  // Unregister widget window on unmount
  useEffect(() => {
    return () => { ownables?.setWidgetWindow(chain.id, null); };
  }, [chain.id, ownables]);

  useEffect(() => {
    if (!ownables) return;
    if (archived) {
      ownables.setWidgetWindow(chain.id, null);
      return;
    }
    if (initialized) {
      ownables.setWidgetWindow(chain.id, iframeRef.current?.contentWindow ?? null);
    }
  }, [archived, chain.id, initialized, ownables]);

  // Apply pending chain events and refresh
  const chainEventCount = chain.events.length;
  const prev = useRef({ initialized, appliedHex: applied.hex });
  useEffect(() => {
    if (isApplying || isExecuting || error) return;

    const partial = chain.startingAfter(appliedRef.current);
    if (partial.events.length > 0) {
      apply(partial).catch((e) => {
        console.error("Error applying chain:", e);
        setError(ownableErrorMessage(e as Error));
      });
    } else if (initialized !== prev.current.initialized || applied.hex !== prev.current.appliedHex) {
      refresh().then();
    }
    prev.current = { initialized, appliedHex: applied.hex };
  // chainEventCount ensures re-run when the chain is mutated externally
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apply, applied, chainEventCount, error, initialized, isApplying, isExecuting, refresh]);

  return {
    iframeRef,
    info,
    metadata,
    attachments,
    isConsumed,
    isClosed,
    isLocked,
    isTransferred,
    isApplying,
    execute,
    onLoad,
  };
}
