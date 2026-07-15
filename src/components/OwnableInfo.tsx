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
import type { AnchorValidationResult } from "@ownables/core";
import EventCard from "./EventCard";
import shortId from "@/utils/shortId";
import { cn } from "@/utils/cn";
import Tooltip from "./Tooltip";
import { Alert } from "@/components/ui/alert";
import { useService } from "@/hooks/useService";

interface OwnableInfoProps {
  className?: string;
  chain: EventChain;
  metadata?: TypedMetadata;
  children?: React.ReactNode;
}

interface HubOwnableVerificationResponse {
  anchorVerification: {
    verified: boolean;
    anchors: Record<string, string | undefined>;
    map: Record<string, string | undefined>;
    details?: AnchorValidationResult["details"];
  };
}

type AnchorVerificationMap = Record<string, string | undefined>;

function deriveAnchorRows(
  chain: EventChain,
  anchorVerification: Pick<AnchorValidationResult, "anchors" | "details"> & {
    map: AnchorVerificationMap;
  }
) {
  return chain.anchorMap.map(({ key, value }) => {
    const detail = anchorVerification.details[key.hex];
    return {
      tx: detail?.transactionHash ?? anchorVerification.anchors[key.hex],
      verified:
        detail?.verified ??
        anchorVerification.map[key.hex]?.toLowerCase() === value.hex.toLowerCase(),
    };
  });
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text.trim() || `status ${response.status}`;
  } catch {
    return `status ${response.status}`;
  }
}

function isUnknownOwnableVerificationFailure(response: Response, message: string): boolean {
  return (
    response.status === 400 &&
    message.toLowerCase().includes("not available on this hub")
  );
}

export default function OwnableInfo(props: OwnableInfoProps) {
  const { chain, metadata } = props;
  const [open, setOpen] = useState(false);
  const [verified, setVerified] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [anchors, setAnchors] = useState<
    Array<{ tx: string | undefined; verified: boolean } | null>
  >([]);
  const hub = useService("hub");
  const eventChains = useService("eventChains");

  const verify = useCallback(
    async (chain: EventChain, open: boolean) => {
      if (!open || !hub?.isConfigured) return;

      const response = await fetch(
        `${hub.origin}/ownables/${encodeURIComponent(chain.id)}/verification`
      );
      if (response.ok) {
        const body =
          (await response.json()) as HubOwnableVerificationResponse;
        const anchorVerification = {
          verified: body.anchorVerification.verified,
          anchors: body.anchorVerification.anchors,
          map: body.anchorVerification.map,
          details: body.anchorVerification.details ?? {},
        };
        setVerificationError(null);
        setVerified(anchorVerification.verified);
        setAnchors(deriveAnchorRows(chain, anchorVerification));
        return;
      }

      const message = await readErrorMessage(response);
      if (!isUnknownOwnableVerificationFailure(response, message)) {
        throw new Error(`Hub verification failed with status ${response.status}`);
      }

      if (!eventChains) {
        throw new Error("Local verification is unavailable.");
      }

      const anchorVerification = await eventChains.verify(chain);
      setVerificationError(null);
      setVerified(anchorVerification.verified);
      setAnchors(deriveAnchorRows(chain, anchorVerification));
    },
    [eventChains, hub]
  );

  useEffect(() => {
    if (!open) {
      setVerified(false);
      setVerificationError(null);
      setAnchors([]);
      return;
    }

    let cancelled = false;

    void verify(chain, open).catch((error) => {
      if (cancelled) {
        return;
      }
      setVerified(false);
      setAnchors([]);
      setVerificationError(
        error instanceof Error ? error.message : "Unable to load Hub verification."
      );
    });

    return () => {
      cancelled = true;
    };
  }, [chain, open, verify]);

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
        {/* Header */}
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
            className={cn("ml-4 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-transparent p-0 text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-[#2a2a2a]")}
          />
        </div>

        {/* Events */}
        <DialogContent>
          {verificationError ? (
            <Alert severity="error" className={cn("rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-200")}>
              Failed to load verification details: {verificationError}
            </Alert>
          ) : chain.events.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              This is a static ownable. It does not contain any events.
            </p>
          ) : (
            chain.events.map((event, i) => (
              <EventCard
                key={event.timestamp}
                event={event}
                anchorTx={anchors[i]?.tx}
                verified={!!anchors[i]?.verified}
                isFirst={i === 0}
              />
            ))
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
