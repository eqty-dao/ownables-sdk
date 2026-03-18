import { Event } from "eqty-core";
import { Box, Card, CardContent, Link } from "@/components/ui";
import AntSwitch from "./AntSwitch";
import { useState } from "react";
import ReactJson from "react-json-view";
import { CircleX as Cancel, CircleCheck as CheckCircle } from "lucide-react";
import shortId from "../utils/shortId";
import { useChainId } from "wagmi";

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

export default function EventCard(props: EventCardProps) {
  const [dataView, setDataView] = useState<DataView>(
    props.event.mediaType === "application/json" ? DataView.JSON : DataView.BASE64
  );
  const { event, anchorTx, verified } = props;
  const chainId = useChainId();

  const getExplorerUrl = (txHash: string, chainId: number) => {
    switch (chainId) {
      case 84532:
        return `https://sepolia.basescan.org/tx/${txHash}`;
      case 8453:
        return `https://basescan.org/tx/${txHash}`;
      default:
        return `https://sepolia.basescan.org/tx/${txHash}`;
    }
  };

  return (
    <Box className="flex flex-col">
      {!props.isFirst && (
        <div className="hidden w-[calc(45%-58px)] self-end truncate rounded-t-lg border border-slate-200 bg-white px-4 py-2 text-xs md:block">
          <strong>Previous: </strong> {shortId(event.previous?.hex ?? "", 30)}
        </div>
      )}
      <Card key={event.hash.base58} className="mb-3 rounded-br-lg rounded-tl-lg border border-slate-200 shadow-sm md:mb-0">
        <CardContent className="space-y-2 p-4 text-xs">
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
          {anchorTx !== null && (
            <div className="mt-2">
              <strong>Anchor tx: </strong>
              <Link href={anchorTx ? getExplorerUrl(anchorTx, chainId) : "#"} target="_blank" rel="noopener noreferrer">
                {anchorTx ? shortId(anchorTx, 10) : "Not anchored"}
              </Link>
              {verified && (
                <CheckCircle className="ml-1 inline-block h-4 w-4 align-middle text-emerald-600" />
              )}
              {!verified && (
                <Cancel className="ml-1 inline-block h-4 w-4 align-middle text-red-600" />
              )}
            </div>
          )}
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
              <ReactJson style={{ marginTop: 10 }} src={event.parsedData ? event.parsedData : event.data} enableClipboard={false} />
            )}
          </div>
          <Box className="truncate pt-2 md:hidden">
            <strong>Hash:</strong> {shortId(event.hash.hex, 30)}
          </Box>
        </CardContent>
      </Card>
      <div className="hidden w-[calc(45%-58px)] self-start truncate rounded-b-lg border border-slate-200 bg-white px-4 py-2 text-xs shadow-sm md:block">
        <strong>Hash:</strong> {shortId(event.hash.hex, 30)}
      </div>
    </Box>
  );
}
