import {
  Tag,
  DialogContent,
  DialogClose,
  IconButton,
  Button,
} from "@/components/ui";
import { useCallback, useEffect, useState } from "react";
import type React from "react";
import { Fingerprint, Info as InfoOutlined } from "lucide-react";
import { TypedMetadata } from "@/interfaces/TypedOwnableInfo";
import { Dialog } from "@/components/ui";
import { EventChain } from "eqty-core";
import EventCard from "./EventCard";
import shortId from "@/utils/shortId";
import Tooltip from "./Tooltip";
import useInterval from "@/hooks/useInterval";
import { useService } from "@/hooks/useService";
import { buildMixedTimelineEntries, type TimelineEntry } from "./ownableTimeline";
import { loadOwnableVerification } from "@/services/ownableVerification";

interface OwnableInfoProps {
  className?: string;
  chain: EventChain;
  metadata?: TypedMetadata;
  children?: React.ReactNode;
}

export default function OwnableInfo(props: OwnableInfoProps) {
  const { chain, metadata } = props;
  const [open, setOpen] = useState(false);
  const [verified, setVerified] = useState(false);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const eventChainService = useService("eventChains");
  const eqty = useService("eqty");
  const hub = useService("hub");

  const verify = useCallback(
    async (nextChain: EventChain, isOpen: boolean) => {
      if (!isOpen || !eventChainService) return;

      const anchorVerification = await eventChainService.verify(nextChain);
      const nextAnchors = nextChain.anchorMap.map(({ key, value }) => ({
        tx: anchorVerification.anchors[key.hex],
        verified: anchorVerification.map[key.hex]?.toLowerCase() === value.hex.toLowerCase(),
      }));

      const ownableVerification = await loadOwnableVerification(
        nextChain,
        anchorVerification,
        eqty,
        hub
      );

      setVerified(ownableVerification.verified);
      setTimeline(
        buildMixedTimelineEntries(
          nextChain,
          ownableVerification.anchorVerification,
          nextAnchors,
          ownableVerification.publicEvents,
          ownableVerification.source === "local" ? "development" : "production"
        )
      );
    },
    [eqty, eventChainService, hub]
  );

  useEffect(() => {
    void verify(chain, open);
  }, [chain, open, verify]);
  useInterval(() => {
    void verify(chain, open);
  }, 5 * 1000);

  const isStaticOwnable = chain.events.length === 0 && timeline.length === 0;

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
        onClose={() => setOpen(false)}
        open={open}
        className="sm:w-[min(900px,calc(100vw-32px))]"
      >
        <div className="flex items-start justify-between px-6 pt-6 pb-1">
          <div className="min-w-0">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <Tooltip title={chain.id}>
                <Tag value={shortId(chain.id)} icon={<Fingerprint className="h-3.5 w-3.5" />} color="info" />
              </Tooltip>
              {verified && <Tag value="Anchors verified" color="success" />}
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{metadata?.name}</h2>
            {metadata?.description && (
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{metadata.description}</p>
            )}
          </div>
          <DialogClose
            aria-label="Close"
            className="ml-4 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-transparent p-0 text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-[#2a2a2a]"
          />
        </div>

        <DialogContent>
          {isStaticOwnable ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              This is a static ownable. It does not contain any events.
            </p>
          ) : (
            timeline.map((entry) => (
              <EventCard
                key={
                  entry.kind === "private"
                    ? entry.event.hash.hex
                    : entry.event.replayKey
                }
                entry={entry}
              />
            ))
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
