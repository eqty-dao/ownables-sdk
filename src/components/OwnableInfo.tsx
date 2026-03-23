import {
  Tag,
  DialogContent,
  DialogTitle,
  IconButton,
} from "@/components/ui";
import { useCallback, useEffect, useState } from "react";
import { Fingerprint, Info as InfoOutlined } from "lucide-react";
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
      <IconButton className={props.className} onClick={() => setOpen(true)}>
        <InfoOutlined />
      </IconButton>
      <Dialog
        onClose={() => setOpen(false)}
        open={open}
        className="w-[min(900px,calc(100vw-32px))]"
      >
        <DialogTitle className="flex items-center gap-2 pb-0 pt-4 text-xs font-semibold text-sky-700">
          <Tooltip title={chain.id}>
            <Tag value={shortId(chain.id)} icon={<Fingerprint className="h-3.5 w-3.5" />} color="info" />
          </Tooltip>
          {verified && (
            <Tag value="Anchors verified" color="success" />
          )}
        </DialogTitle>
        <DialogTitle className="pb-1 pt-1 text-xl font-semibold">{metadata?.name}</DialogTitle>
        <DialogTitle className="pb-2 pt-0 text-sm text-slate-500 dark:text-slate-400">
          {metadata?.description}
        </DialogTitle>
        <DialogContent>
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
