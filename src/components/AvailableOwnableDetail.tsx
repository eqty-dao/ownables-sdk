import { Box, Button, IconButton, Link, Tile } from "@/components/ui";
import { ArrowLeft, Box as BoxIcon, ExternalLink, LoaderCircle } from "lucide-react";
import { cva } from "class-variance-authority";
import { cn } from "@/utils/cn";
import shortId from "@/utils/shortId";
import type { AvailableOwnableEntry } from "@/hooks/useOwnables";
import OwnableActions from "./OwnableActions";

interface AvailableOwnableDetailProps {
  ownable: AvailableOwnableEntry;
  archived?: boolean;
  isImporting?: boolean;
  onBack: () => void;
  onImport: () => void | Promise<void>;
  onArchive: () => void;
  onRestore: () => void;
  onDelete: () => void;
}

const primaryButton = cva(
  "w-full rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-indigo-700 active:bg-indigo-800 lg:py-4 lg:text-lg"
);

const secondaryButton = cva(
  "w-full rounded-xl border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-700 transition-colors hover:bg-slate-50 active:bg-slate-100 dark:border-[#343434] dark:bg-[#202020] dark:text-slate-100 dark:hover:bg-[#262626] dark:active:bg-[#2c2c2c] lg:py-4 lg:text-lg"
);

const issuerLink = cva("font-mono link-primary hover:underline");

export default function AvailableOwnableDetail({
  ownable,
  archived = false,
  isImporting = false,
  onBack,
  onImport,
  onArchive,
  onRestore,
  onDelete,
}: AvailableOwnableDetailProps) {
  const shortIssuer = ownable.issuer
    ? shortId(ownable.issuer, 10, "...")
    : undefined;

  return (
    <Box className="mx-auto lg:max-w-2xl lg:px-8 lg:pt-5">
      <Box className="lg:mb-6 lg:rounded-2xl lg:border lg:border-slate-200 lg:bg-white lg:p-8 lg:shadow-sm dark:lg:border-[#2a2a2a] dark:lg:bg-[#1a1a1a]">
        <Box className="flex items-center gap-3 border-b border-slate-200 p-4 dark:border-[#2a2a2a] lg:mx-auto lg:mb-6 lg:max-w-125 lg:items-start lg:gap-4 lg:border-b-0 lg:p-0">
          <IconButton aria-label="Back" onClick={onBack} className="shrink-0 lg:hidden">
            <ArrowLeft className="h-5 w-5" />
          </IconButton>
          <Box className="min-w-0 flex-1">
            <h2 className="text-section-title mb-0.5 text-lg lg:mb-1 lg:text-xl">{ownable.title}</h2>
            {ownable.issuer ? (
              <p className="text-meta">
                <Link
                  href={`https://basescan.org/address/${ownable.issuer}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(issuerLink())}
                >
                  {shortIssuer}
                  <ExternalLink size={16} className="ml-1.5 inline" style={{ verticalAlign: "-2px" }} />
                </Link>
              </p>
            ) : null}
          </Box>
          {archived ? (
            <OwnableActions
              className="lg:-mr-3"
              archived={true}
              isTransferable={false}
              isHubAvailable={false}
              isClosable={false}
              isClosed={false}
              isLockable={false}
              isLocked={false}
              onDelete={onDelete}
              onCloseOwnable={() => {}}
              onTransfer={() => {}}
              onLock={() => {}}
              onRestore={onRestore}
            />
          ) : null}
        </Box>

        <Box className="relative mx-4 overflow-hidden rounded-2xl bg-slate-100 dark:bg-[#202020] lg:mx-auto lg:mb-6 lg:max-w-125" style={{ aspectRatio: "3 / 4" }}>
          {ownable.package.thumbnailUrl ? (
            <img src={ownable.package.thumbnailUrl} alt={ownable.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Tile
                size="lg"
                variant="brand"
                className="rounded-[20px]"
                icon={<BoxIcon aria-label="No image" className="h-12 w-12 text-indigo-400 dark:text-indigo-300" />}
              />
            </div>
          )}
        </Box>

        {!archived ? (
          <Box className="mx-4 mt-4 space-y-3 lg:mx-auto lg:mt-0 lg:max-w-125">
          <Button
            aria-label="Import from Hub"
            className={cn(primaryButton())}
            onClick={onImport}
            disabled={isImporting}
          >
            {isImporting ? <LoaderCircle className="h-5 w-5 animate-spin" /> : null}
            {isImporting ? "Importing from Hub" : "Import from Hub"}
          </Button>
          <Button
            aria-label="Archive"
            className={cn(secondaryButton())}
            onClick={onArchive}
            disabled={isImporting}
          >
            Archive
          </Button>
          </Box>
        ) : null}
      </Box>

      <Box className="px-4 pb-8 lg:px-2 lg:pb-0">
        <h2 className="text-caption mb-2 uppercase tracking-wide">About</h2>
        {ownable.description ? (
          <p className="text-body">{ownable.description}</p>
        ) : (
          <p className="text-body text-slate-500 dark:text-slate-400">
            This ownable is available on the Hub and can be imported into this wallet.
          </p>
        )}
      </Box>
    </Box>
  );
}
