import {
  Tag,
  DialogContent,
  DialogClose,
  IconButton,
  Button,
} from "@/components/ui";
import { useEffect, useMemo, useState } from "react";
import type React from "react";
import { Fingerprint, Info as InfoOutlined } from "lucide-react";
import { TypedMetadata } from "@/interfaces/TypedOwnableInfo";
import { Dialog } from "@/components/ui";
import { EventChain } from "eqty-core";
import type { HubService } from "@ownables/platform-browser";
import { useChainId } from "wagmi";
import EventCard from "./EventCard";
import shortId from "@/utils/shortId";
import { cn } from "@/utils/cn";
import Tooltip from "./Tooltip";
import { Alert } from "@/components/ui/alert";
import { useService } from "@/hooks/useService";
import PublicEventCard from "./PublicEventCard";
import {
  buildPublicEventTimeline,
  type TimelinePublicEvent,
} from "@/utils/publicEventTimeline";

interface OwnableInfoProps {
  className?: string;
  chain: EventChain;
  metadata?: TypedMetadata;
  trackedPublicEvents?: TimelinePublicEvent[];
  children?: React.ReactNode;
}

interface AnchorRow {
  tx?: string;
  verified: boolean;
  blockNumber?: number;
}

interface Verification {
  chain: EventChain;
  chainId: number;
  hub: HubService;
  rows?: AnchorRow[];
  verified?: boolean;
  error?: string;
  contract?: string;
}

export default function OwnableInfo(props: OwnableInfoProps) {
  const { chain, metadata, trackedPublicEvents } = props;
  const [open, setOpen] = useState(false);
  const [verification, setVerification] = useState<Verification>();
  const hub = useService("hub");
  const anchorValidation = useService("anchorValidation");
  const chainId = useChainId();
  const current =
    verification?.chain === chain &&
    verification.chainId === chainId &&
    verification.hub === hub
      ? verification
      : undefined;
  const timeline = useMemo(
    () => buildPublicEventTimeline(chain.events, trackedPublicEvents),
    [chain.events, trackedPublicEvents]
  );

  useEffect(() => {
    if (!open || !hub?.isConfigured || !anchorValidation || chain.events.length === 0) return;
    const request = new AbortController();

    async function verify(
      configuredHub: HubService,
      validator: NonNullable<typeof anchorValidation>
    ) {
      const genesisNetwork = chain.events[0]?.parsedData?.network_id;
      if (String(genesisNetwork).replace(/^eip155:/, "") !== String(chainId)) {
        throw new Error("The Ownable does not belong to the connected network.");
      }
      const expected = chain.anchorMap;
      const evidence = await configuredHub.loadAnchorEvidence(
        expected.map(({ key, signer }) => ({ key: key.hex, signer })),
        request.signal
      );
      if (request.signal.aborted) return;

      const result = validator.validateAgainstIndexedRecords(expected, evidence.records);
      const rows = expected.map(({ key }) => {
        const detail = result.details[key.hex];
        return {
          tx: detail?.transactionHash,
          verified: detail?.source === "indexed" && detail.verified,
          blockNumber: detail?.blockNumber,
        };
      });
      setVerification({
        chain,
        chainId,
        hub: configuredHub,
        rows,
        verified: result.verified,
        contract: evidence.anchorContractAddress,
      });
    }

    void verify(hub, anchorValidation).catch((error: unknown) => {
      if (!request.signal.aborted) {
        setVerification({
          chain,
          chainId,
          hub,
          error: error instanceof Error ? error.message : "Unable to load Hub anchor evidence.",
        });
      }
    });
    return () => request.abort();
  }, [anchorValidation, chain, chainId, hub, open]);

  return (
    <>
      {props.children ? (
        <Button className={props.className} onClick={() => setOpen(true)}>
          {props.children}
        </Button>
      ) : (
        <IconButton className={props.className} onClick={() => setOpen(true)}>
          <InfoOutlined />
        </IconButton>
      )}
      <Dialog
        onClose={() => {
          setOpen(false);
          setVerification(undefined);
        }}
        open={open}
        className="sm:w-[min(900px,calc(100vw-32px))]"
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-1">
          <div className="min-w-0">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <Tooltip title={chain.id}>
                <Tag value={shortId(chain.id)} icon={<Fingerprint className="h-3.5 w-3.5" />} color="info" />
              </Tooltip>
              {current?.verified && <Tag value="Anchors verified" color="success" />}
              {current?.contract && (
                <Tooltip title={current.contract}>
                  <Tag value="Hub anchor evidence" color="info" />
                </Tooltip>
              )}
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{metadata?.name}</h2>
            {metadata?.description && (
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{metadata.description}</p>
            )}
          </div>
          <DialogClose
            aria-label="Close"
            className={cn("ml-4 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-transparent p-0 text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-[#2a2a2a]")}
          />
        </div>

        {/* Events */}
        <DialogContent>
          {current?.error && (
            <Alert severity="error" className={cn("rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-200")}>
              Anchor verification unavailable: {current.error}
            </Alert>
          )}
          {timeline.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              This is a static ownable. It does not contain any events.
            </p>
          ) : (
            timeline.map((item, timelineIndex) =>
              item.kind === "public" ? (
                <PublicEventCard key={item.key} record={item.record} />
              ) : (
                <EventCard
                  key={item.key}
                  event={item.event}
                  anchorTx={current?.rows?.[item.chainIndex]?.tx}
                  anchorBlock={current?.rows?.[item.chainIndex]?.blockNumber}
                  anchorLookupComplete={!!current?.rows}
                  verified={!!current?.rows?.[item.chainIndex]?.verified}
                  isFirst={timelineIndex === 0}
                />
              )
            )
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
