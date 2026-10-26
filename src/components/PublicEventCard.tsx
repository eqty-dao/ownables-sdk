import { Box, Card, CardContent, Tag } from "@/components/ui";
import type { TimelinePublicEvent } from "@/utils/publicEventTimeline";
import { cn } from "@/utils/cn";

interface PublicEventCardProps {
  record: TimelinePublicEvent;
}

export default function PublicEventCard({ record }: PublicEventCardProps) {
  const pending = record.status === "pending";
  const eventName = record.event.eventType || "Public event";

  return (
    <Box className="flex flex-col" data-testid={`public-event-${record.replayKey}`}>
      <Card
        className={cn(
          "mb-3 overflow-x-auto rounded-br-lg rounded-tl-lg border border-sky-200 bg-sky-50 shadow-sm",
          "dark:border-sky-900/70 dark:bg-sky-950/30 md:mb-0"
        )}
      >
        <CardContent className="space-y-2 p-4 text-xs text-slate-800 dark:text-slate-200">
          <div className="flex flex-wrap items-center gap-2">
            <strong>Public event: {eventName}</strong>
            <Tag value={pending ? "Pending" : "Confirmed"} color={pending ? "warning" : "success"} />
          </div>
          <div>
            <strong>Block position: </strong>
            {record.event.blockNumber}, transaction {record.event.transactionIndex}, log {record.event.logIndex}
          </div>
          {record.localDisplayError ? (
            <p
              className={cn(
                "rounded-lg border border-amber-200 bg-amber-50 p-2 text-amber-900",
                "dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-100"
              )}
            >
              Local application failed: {record.localDisplayError}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </Box>
  );
}
