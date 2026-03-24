import {
  Tag,
  DialogContent,
  DialogTitle,
  DialogClose,
  IconButton,
  Button,
} from "@/components/ui";
import { useCallback, useEffect, useState } from "react";
import type React from "react";
import { Fingerprint, Info as InfoOutlined, X } from "lucide-react";
import { TypedMetadata } from "@/interfaces/TypedOwnableInfo";
import { Dialog } from "@/components/ui";
import { EventChain } from "eqty-core";
import EventCard from "./EventCard";
import shortId from "@/utils/shortId";
import Tooltip from "./Tooltip";
import useInterval from "@/hooks/useInterval";
import { useService } from "@/hooks/useService"

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
  const [anchors, setAnchors] = useState<
    Array<{ tx: string | undefined; verified: boolean } | null>
  >([]);
  const eventChainService = useService('eventChains');

  const verify = useCallback((chain: EventChain, open: boolean) => {
    if (!open || !eventChainService) return;

    eventChainService.verify(chain).then(({ verified, anchors, map }) => {
      setVerified(verified);
      setAnchors(
        chain.anchorMap.map(({ key, value }) => ({
          tx: anchors[key.hex],
          verified: map[key.hex]?.toLowerCase() === value.hex.toLowerCase(),
        }))
      );
    });
  }, [eventChainService]);

  useEffect(() => verify(chain, open), [chain, open, verify]);
  useInterval(() => verify(chain, open), 5 * 1000);

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
        <div className="flex items-start justify-between px-4 pt-4 sm:px-6">
          <div>
            <DialogTitle className="flex items-center gap-2 pb-0 pt-0 text-xs font-semibold text-sky-700">
              <Tooltip title={chain.id}>
                <Tag value={shortId(chain.id)} icon={<Fingerprint className="h-3.5 w-3.5" />} color="info" />
              </Tooltip>
              {verified && (
                <Tag value="Anchors verified" color="success" />
              )}
            </DialogTitle>
            <DialogTitle className="pb-1 pt-1 text-xl font-semibold">{metadata?.name}</DialogTitle>
          </div>
          <DialogClose
            aria-label="Close"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-transparent p-0 text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-[#2a2a2a]"
          >
            <X className="h-5 w-5" />
          </DialogClose>
        </div>
        <DialogTitle className="px-4 pb-2 pt-0 mb-2 text-sm text-slate-500 dark:text-slate-400 sm:px-6">
          {metadata?.description}
        </DialogTitle>
        <DialogContent className="px-4 pb-4 sm:px-6 sm:pb-6">
          {chain.events.length === 0 && (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              This is a static ownable. It does not contain any events.
            </p>
          )}
          {chain.events.map((event, i) => (
            <EventCard
              key={event.timestamp}
              event={event}
              anchorTx={anchors[i]?.tx}
              verified={!!anchors[i]?.verified}
              isFirst={i === 0}
            />
          ))}
        </DialogContent>
      </Dialog>
    </>
  );
}
