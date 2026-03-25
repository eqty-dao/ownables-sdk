import { Event } from "eqty-core";
import { Box, Card, CardContent, Link } from "@/components/ui";
import AntSwitch from "./AntSwitch";
import { useState } from "react";
import ReactJson from "react-json-view";
import { CircleX as Cancel, CircleCheck as CheckCircle } from "lucide-react";
import shortId from "@/utils/shortId";
import { useChainId } from "wagmi";
import { useExplorerUrl } from "@/hooks/useExplorerUrl";
import { cva } from "class-variance-authority";
import { cn } from "@/utils/cn";

interface EventCardProps {
  event: Event;
  anchorTx: string | undefined;
  verified: boolean;
  isFirst: boolean;
}

enum DataView {
  BASE64,
  JSON,
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

export default function EventCard(props: EventCardProps) {
  const [dataView, setDataView] = useState<DataView>(
    props.event.mediaType === "application/json" ? DataView.JSON : DataView.BASE64
  );
  const { event, anchorTx, verified } = props;
  const chainId = useChainId();
  const txUrl = useExplorerUrl(chainId, anchorTx ? `tx/${anchorTx}` : "");

  return (
    <Box className="flex flex-col">
      {!props.isFirst && (
        <div className={cn(railBlock({ edge: "top" }))}>
          <strong>Previous: </strong> {shortId(event.previous?.hex ?? "", 30)}
        </div>
      )}
      <Card key={event.hash.base58} className="mb-3 overflow-x-scroll rounded-br-lg rounded-tl-lg border border-slate-200 shadow-sm dark:border-slate-700 dark:bg-slate-900 md:mb-0">
        <CardContent className="space-y-2 p-4 pb-0 text-xs text-slate-800 dark:text-slate-200">
          <div>
            <strong>Timestamp: </strong>
            {event.timestamp ? new Date(event.timestamp).toString() : ""}
          </div>
          <div className="truncate">
            <strong>Signed by:</strong> {event.signerAddress ?? ""}
          </div>
          <div className="truncate">
            <strong>Signature:</strong> {event.signature?.hex ?? ""}
          </div>
          <div className="mt-2">
            <strong>Anchor tx: </strong>
            {anchorTx ? (
              <>
                <Link
                  href={txUrl ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link-primary"
                >
                  {shortId(anchorTx, 10)}
                </Link>
                {verified ? (
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
            <strong>Media type:</strong> {event.mediaType}
          </div>
          <div>
            <strong>Data: </strong>
            <span className="mr-1">base64</span>
            <AntSwitch
              disabled={event.mediaType !== "application/json"}
              checked={dataView === DataView.JSON}
              onChange={(_, checked) => setDataView(checked ? DataView.JSON : DataView.BASE64)}
              className="inline-flex align-middle"
            />
            <span className="ml-1">JSON</span>
            {dataView === DataView.BASE64 && (
              <pre className="base64 mb-0">{event.data.base64}</pre>
            )}
            {dataView === DataView.JSON && (
              <ReactJson
                style={{ marginTop: 10 }}
                src={event.parsedData ? event.parsedData : event.data}
                enableClipboard={false}
                theme={document.documentElement.classList.contains("dark") ? "summerfruit:inverted" : "rjv-default"}
              />
            )}
          </div>
          <Box className="truncate pt-2 md:hidden">
            <strong>Hash:</strong> {shortId(event.hash.hex, 30)}
          </Box>
        </CardContent>
      </Card>
      <div className={cn(railBlock({ edge: "bottom" }))}>
        <strong>Hash:</strong> {shortId(event.hash.hex, 30)}
      </div>
    </Box>
  );
}
