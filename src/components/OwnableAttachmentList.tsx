import { useMemo, useState } from "react";
import type { TypedAttachment } from "@/interfaces/TypedAttachment";
import { IconButton } from "@/components/ui";
import { ChevronDown, ChevronRight, Download } from "lucide-react";

const attachmentChevronClass = "h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400";

interface OwnableAttachmentListProps {
  attachments: TypedAttachment[];
  onDownloadAttachment: (name: string, cid: string) => void;
}

export default function OwnableAttachmentList(props: OwnableAttachmentListProps) {
  const { attachments, onDownloadAttachment } = props;
  const [expandedAttachments, setExpandedAttachments] = useState<Set<string>>(
    () => new Set()
  );
  const groupedAttachments = useMemo(() => {
    const groups = new Map<string, TypedAttachment[]>();
    for (const attachment of attachments) {
      const existing = groups.get(attachment.name) ?? [];
      existing.push(attachment);
      groups.set(attachment.name, existing);
    }
    return Array.from(groups.entries()).map(([name, versions]) => ({
      name,
      versions,
    }));
  }, [attachments]);

  const toggleAttachmentGroup = (name: string) => {
    setExpandedAttachments((current) => {
      const next = new Set(current);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  if (groupedAttachments.length === 0) {
    return (
      <p className="text-body text-slate-500 dark:text-slate-400">No attachments yet.</p>
    );
  }

  return (
    <div className="space-y-4">
      {groupedAttachments.map(({ name, versions }) => {
        const isExpanded = expandedAttachments.has(name);
        const latestVersion = versions[versions.length - 1];

        return (
          <div
            key={name}
            className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-[#2a2a2a] dark:bg-[#1a1a1a]"
          >
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
                onClick={() => toggleAttachmentGroup(name)}
                aria-label={`${name} ${versions.length === 1 ? "1 version" : `${versions.length} versions`}`}
                aria-expanded={isExpanded}
              >
                {isExpanded ? (
                  <ChevronDown className={attachmentChevronClass} />
                ) : (
                  <ChevronRight className={attachmentChevronClass} />
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {name}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {versions.length === 1 ? "1 version" : `${versions.length} versions`}
                  </p>
                </div>
              </button>
              {!isExpanded ? (
                <IconButton
                  aria-label={`Download latest ${name}`}
                  variant="ghost"
                  onClick={() => onDownloadAttachment(name, latestVersion.cid)}
                >
                  <Download className="h-4 w-4" />
                </IconButton>
              ) : null}
            </div>
            {isExpanded ? (
              <ul className="mt-3 space-y-2">
                {versions.map((version, index) => (
                  <li
                    key={`${version.cid}-${index}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-900/60"
                  >
                    <code className="text-xs text-slate-600 dark:text-slate-300">
                      {version.cid}
                    </code>
                    <IconButton
                      aria-label={`Download ${name} version ${index + 1}`}
                      variant="ghost"
                      onClick={() => onDownloadAttachment(name, version.cid)}
                    >
                      <Download className="h-4 w-4" />
                    </IconButton>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
