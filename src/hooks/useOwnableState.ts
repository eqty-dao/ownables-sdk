import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EventChain } from "eqty-core";
import type { ReplayAttemptResult, StateDump } from "@ownables/core";
import type { TypedAttachment } from "@/interfaces/TypedAttachment";
import { TypedMetadata, TypedOwnableInfo } from "@/interfaces/TypedOwnableInfo";
import { TypedPackage } from "@/interfaces/TypedPackage";
import TypedDict from "@/interfaces/TypedDict";
import isObject from "@/utils/isObject";
import ownableErrorMessage from "@/utils/ownableErrorMessage";
import { useService } from "./useService";
import { useAccount } from "wagmi";
import { useProgress, LogProgress } from "@/contexts/Progress.context";

function getWidgetEmitEnvelope(msg: unknown): { eventType: string; payload: TypedDict } {
  if (!isObject(msg)) {
    throw new Error("Widget emit msg must be an object");
  }

  const entries = Object.entries(msg as Record<string, unknown>);
  if (entries.length !== 1) {
    throw new Error("Widget emit msg must contain exactly one event key");
  }

  const [eventType, payload] = entries[0] as [string, unknown];
  if (!isObject(payload)) {
    throw new Error("Widget emit payload must be an object");
  }

  return { eventType, payload: payload as TypedDict };
}

export function useOwnableState(
  chain: EventChain,
  pkg: TypedPackage | undefined,
  onError: (title: string, message: string) => void,
  archived = false,
  publicEventRefreshToken = 0,
  onPublicEventsChanged?: (
    entryId: string,
    replay: ReplayAttemptResult
  ) => void | Promise<void>
) {
  const ownables = useService("ownables");
  const eventChains = useService("eventChains");
  const eqty = useService("eqty");
  const { address: liveAddress } = useAccount();
  const progress = useProgress();

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const busyRef = useRef(false);
  const appliedRef = useRef<any>(new EventChain(chain.id).latestHash);
  const publicEventRefreshRef = useRef(publicEventRefreshToken);

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

      if (pkg.hasWidgetState) {
        ownables.setWidgetWindow(
          chain.id,
          archived ? null : iframeRef.current?.contentWindow ?? null
        );
        const widgetState = await ownables
          .rpc(chain.id)
          .query({ get_widget_state: {} }, effective);
        iframeRef.current?.contentWindow?.postMessage(
          { ownable_id: chain.id, state: widgetState },
          "*"
        );
      }

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
    [archived, chain.id, metadata, ownables, pkg, stateDump]
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
        await refresh(sd);
        appliedRef.current = chain.latestHash;
        setApplied(chain.latestHash);
        setStateDump(sd);
      } catch (e) {
        onError("The Ownable returned an error", ownableErrorMessage(e));
        throw e;
      } finally {
        setIsExecuting(false);
      }
    },
    [archived, chain, eventChains, ownables, onError, refresh, stateDump]
  );

  const emit = useCallback(
    async (
      msg: TypedDict,
      onProgress?: LogProgress
    ): Promise<void> => {
      if (!ownables) return;
      if (archived) {
        const message = "Archived ownables are read-only";
        onError("Interaction unavailable", message);
        throw new Error(message);
      }

      const { eventType, payload } = getWidgetEmitEnvelope(msg);

      try {
        setIsExecuting(true);
        const replay = await ownables.emitPublicEvent(
          chain,
          eventType,
          payload,
          onProgress as any
        );
        await onPublicEventsChanged?.(chain.id, replay);
        await refresh(replay.stateDump);
        appliedRef.current = chain.latestHash;
        setApplied(chain.latestHash);
        setStateDump(replay.stateDump);
      } catch (e) {
        onError("The Ownable returned an error", ownableErrorMessage(e));
        throw e;
      } finally {
        setIsExecuting(false);
      }
    },
    [archived, chain, eventChains, onError, onPublicEventsChanged, ownables, refresh]
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

  // Window message handler for widget-triggered actions
  const windowMessageHandler = useCallback(
    async (event: MessageEvent) => {
      if (!isObject(event.data) || !("ownable_id" in event.data) || event.data.ownable_id !== chain.id) return;
      if (iframeRef.current?.contentWindow !== event.source)
        throw Error("Not allowed to execute msg on other Ownable");
      if (archived) {
        onError("Interaction unavailable", "Archived ownables are read-only");
        return;
      }

      try {
        const isEmit = event.data.type === "emit";
        if (!isEmit && event.data.type !== "execute") return;

        const steps = isEmit
          ? [{ id: "emitPublicEvent", label: "Emit the public event" }]
          : [{ id: "signEvent", label: "Sign the event" }];
        if (!isEmit && ownables?.anchoring) {
          steps.push({ id: "anchor", label: "Anchor the event" });
        }

        const [ctrl, onProgress] = progress.open({ title: "Processing action", steps });
        if (isEmit) {
          await emit(event.data.msg, onProgress);
        } else {
          await execute(event.data.msg, onProgress);
        }
        ctrl.close();
      } catch (e) {
        console.error("Widget action failed", e);
      }
    },
    [archived, chain.id, emit, execute, progress, ownables, onError]
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

  useEffect(() => {
    if (publicEventRefreshToken === publicEventRefreshRef.current) {
      return;
    }

    publicEventRefreshRef.current = publicEventRefreshToken;

    if (!initialized || !eventChains) {
      return;
    }

    let cancelled = false;

    const sync = async () => {
      const nextStateDump = await eventChains.getStateDump(chain.id, chain.state.hex);
      if (!nextStateDump || cancelled) {
        return;
      }

      setStateDump(nextStateDump);
      await refresh(nextStateDump);
    };

    void sync();

    return () => {
      cancelled = true;
    };
  }, [chain.id, chain.state.hex, eventChains, initialized, publicEventRefreshToken, refresh]);

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
