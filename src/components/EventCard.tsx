import { Binary } from "eqty-core";
import { Box, Card, CardContent, Link, Tag } from "@/components/ui";
import AntSwitch from "./AntSwitch";
import { useState } from "react";
import { CircleX as Cancel, CircleCheck as CheckCircle } from "lucide-react";
import shortId from "@/utils/shortId";
import { useChainId } from "wagmi";
import { useExplorerUrl } from "@/hooks/useExplorerUrl";
import { cva } from "class-variance-authority";
import { cn } from "@/utils/cn";
import type { TimelineEntry } from "./ownableTimeline";

enum DataView {
  BASE64,
  JSON,
}

function stringifyEventData(value: unknown): string {
  return JSON.stringify(
    value,
    (_, currentValue) =>
      typeof currentValue === "bigint"
        ? currentValue.toString()
        : currentValue instanceof Uint8Array
          ? Array.from(currentValue)
          : currentValue,
    2
  );
}

const railBlock = cva(
  "hidden w-[calc(45%-58px)] truncate border border-slate-200 z-1 bg-white px-4 py-2 text-xs dark:border-slate-700 dark:bg-slate-900 md:block",
  {
    variants: {
      edge: {
        top: "self-end rounded-t-lg mb-[-2px] border-b-0",
        bottom: "self-start rounded-b-lg shadow-sm mt-[-2px] border-t-0",
      },
    },
  }
);

const cardStyle = cva(
  "mb-3 overflow-x-auto rounded-br-lg rounded-tl-lg border shadow-sm md:mb-0",
  {
    variants: {
      kind: {
        private: "border-slate-200 dark:border-slate-700 dark:bg-slate-900",
        public:
          "border-amber-200 bg-amber-50/70 dark:border-amber-800 dark:bg-amber-950/40",
      },
    },
  }
);

interface EventCardProps {
  entry: TimelineEntry;
}

function PrivateEventCard({ entry }: { entry: Extract<TimelineEntry, { kind: "private" }> }) {
  const [dataView, setDataView] = useState<DataView>(
    entry.event.mediaType === "application/json" ? DataView.JSON : DataView.BASE64
  );
  const chainId = useChainId();
  const txUrl = useExplorerUrl(
    chainId,
    entry.anchorTx ? `tx/${entry.anchorTx}` : ""
  );

  return (
    <Box
      className="flex flex-col"
      data-testid="private-event-card"
      data-timeline-kind="private"
    >
      {!entry.isFirst && (
        <div className={cn(railBlock({ edge: "top" }))}>
          <strong>Previous: </strong> {shortId(entry.event.previous?.hex ?? "", 30)}
        </div>
      )}
      <Card className={cn(cardStyle({ kind: "private" }))}>
        <CardContent className="space-y-2 p-4 pb-0 text-xs text-slate-800 dark:text-slate-200">
          <div className="flex flex-wrap items-center gap-2">
            <Tag value="Private chain event" color="info" />
          </div>
          <div>
            <strong>Timestamp: </strong>
            {entry.event.timestamp ? new Date(entry.event.timestamp).toString() : ""}
          </div>
          <div className="truncate">
            <strong>Signed by:</strong> {entry.event.signerAddress ?? ""}
          </div>
          <div className="truncate">
            <strong>Signature:</strong> {entry.event.signature?.hex ?? ""}
          </div>
          <div className="mt-2">
            <strong>Anchor tx: </strong>
            {entry.anchorTx ? (
              <>
                <Link
                  href={txUrl ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link-primary"
                >
                  {shortId(entry.anchorTx, 10)}
                </Link>
                {entry.verified ? (
                  <CheckCircle className="ml-1 inline-block h-4 w-4 align-middle text-emerald-600" />
                ) : (
                  <Cancel className="ml-1 inline-block h-4 w-4 align-middle text-red-600" />
                )}
              </>
            ) : (
              <span className="text-slate-500 dark:text-slate-400">Not anchored</span>
            )}
          </div>
          <div className="mt-2">
            <strong>Media type:</strong> {entry.event.mediaType}
          </div>
          <div>
            <strong>Data: </strong>
            <span className="mr-1">base64</span>
            <AntSwitch
              disabled={entry.event.mediaType !== "application/json"}
              checked={dataView === DataView.JSON}
              onChange={(_, checked) => setDataView(checked ? DataView.JSON : DataView.BASE64)}
              className="inline-flex align-middle"
            />
            <span className="ml-1">JSON</span>
            {dataView === DataView.BASE64 && (
              <pre className="base64 mb-0">{entry.event.data.base64}</pre>
            )}
            {dataView === DataView.JSON && (
              <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all rounded-md bg-slate-50 p-3 text-xs text-slate-800 dark:bg-slate-950 dark:text-slate-200">
                {stringifyEventData(entry.event.parsedData ?? entry.event.data)}
              </pre>
            )}
          </div>
          <Box className="truncate pt-2 md:hidden">
            <strong>Hash:</strong> {shortId(entry.event.hash.hex, 30)}
          </Box>
        </CardContent>
      </Card>
      <div className={cn(railBlock({ edge: "bottom" }))}>
        <strong>Hash:</strong> {shortId(entry.event.hash.hex, 30)}
      </div>
    </Box>
  );
}

function PublicEventCard({ entry }: { entry: Extract<TimelineEntry, { kind: "public" }> }) {
  const chainId = useChainId();
  const txUrl = useExplorerUrl(chainId, `tx/${entry.event.transactionHash}`);
  const [dataView, setDataView] = useState<DataView>(DataView.JSON);
  const dataBase64 = Binary.fromHex(entry.event.data).base64;

  return (
    <Card
      className={cn(cardStyle({ kind: "public" }))}
      data-testid="public-event-card"
      data-timeline-kind="public"
      data-event-type={entry.event.eventType}
    >
      <CardContent className="space-y-2 p-4 text-xs text-slate-800 dark:text-slate-100">
        <div className="flex flex-wrap items-center gap-2">
          <Tag value="Public replay event" color="warning" />
          <Tag
            value={
              entry.event.replayStatus === "applied" ? "Replay applied" : "Replay ignored"
            }
            color={entry.event.replayStatus === "applied" ? "success" : "danger"}
          />
        </div>
        <div>
          <strong>Event type:</strong> {entry.event.eventType}
        </div>
        <div className="truncate">
          <strong>Source:</strong> {entry.event.source}
        </div>
        <div>
          <strong>Anchor tx:</strong>{" "}
          <Link
            href={txUrl ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="link-primary"
          >
            {shortId(entry.event.transactionHash, 10)}
          </Link>
        </div>
        <div>
          <strong>Ordering:</strong> block {entry.event.blockNumber}, tx{" "}
          {entry.event.transactionIndex}, log {entry.event.logIndex}
        </div>
        <div>
          <strong>Timestamp:</strong>{" "}
          {entry.event.timestamp
            ? new Date(entry.event.timestamp * 1000).toString()
            : "Not available"}
        </div>
        {entry.event.ignoredReason ? (
          <div>
            <strong>Replay note:</strong> {entry.event.ignoredReason}
          </div>
        ) : null}
        <div>
          <strong>Data:</strong>
          <span className="ml-2 mr-1">base64</span>
          <AntSwitch
            checked={dataView === DataView.JSON}
            onChange={(_, checked) => setDataView(checked ? DataView.JSON : DataView.BASE64)}
            className="inline-flex align-middle"
          />
          <span className="ml-1">JSON</span>
          {dataView === DataView.BASE64 ? (
            <pre className="base64 mb-0 mt-2">{dataBase64}</pre>
          ) : (
            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all rounded-md bg-white/70 p-3 text-xs text-slate-800 dark:bg-slate-950/60 dark:text-slate-100">
              {stringifyEventData(entry.event.payloadJson)}
            </pre>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function EventCard({ entry }: EventCardProps) {
  return entry.kind === "private" ? (
    <PrivateEventCard entry={entry} />
  ) : (
    <PublicEventCard entry={entry} />
  );
}
