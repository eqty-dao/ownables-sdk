import { TypedPackage, TypedPackageStub } from "../interfaces/TypedPackage";
import { Box, Button, IconButton, Skeleton } from "@/components/ui";
import { Dialog } from "@/components/ui";
import { ChevronRight, FolderUp, Sparkles, X as CloseIcon } from "lucide-react";
import { useService } from "../hooks/useService";
import { cva } from "class-variance-authority";
import { cn } from "../utils/cn";

const topActionButton = cva(
  "inline-flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors",
  {
    variants: {
      emphasis: {
        primary: "border-slate-300 bg-white text-slate-800 hover:bg-slate-50",
        secondary: "border-slate-300 bg-slate-100 text-slate-800 hover:bg-slate-200",
      },
      disabled: {
        true: "cursor-not-allowed opacity-50",
        false: "",
      },
    },
    defaultVariants: {
      emphasis: "primary",
      disabled: false,
    },
  }
);

interface PackagesDialogProps {
  packages: Array<TypedPackage | TypedPackageStub>;
  open: boolean;
  inline?: boolean;
  onClose: () => void;
  onSelect: (pkg: TypedPackage | TypedPackageStub) => void;
  onImport: () => void;
  fetchPkgFromRelay: () => void;
  onCreate: () => void;
  message: number;
  isLoading: boolean;
}

export function PackagesDialog(props: PackagesDialogProps) {
  const { onClose, onSelect, onImport, onCreate, open, isLoading, inline } = props;
  const filteredPackages = props.packages.filter((pkg) => !pkg.isNotLocal);
  const builderService = useService("builder");
  const hasBuilder = !!builderService;

  const content = (
    <Box className={inline ? "w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" : ""}>
      <Box className="mb-2 flex items-start gap-1.5">
        <IconButton onClick={onClose} aria-label="Close issue ownable modal">
          <CloseIcon size={18} />
        </IconButton>
        <Box>
          <h2 className="text-2xl font-bold leading-tight">
            Issue an Ownable
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Select a package or create a new one
          </p>
        </Box>
      </Box>

      <div className="mb-4 flex items-center gap-2">
        <button type="button" className={cn(topActionButton({ emphasis: "primary" }))} onClick={onImport}>
          <FolderUp size={16} />
          Upload
        </button>
        <button
          type="button"
          className={cn(topActionButton({ emphasis: "secondary", disabled: !hasBuilder }))}
          onClick={onCreate}
          disabled={!hasBuilder}
        >
          <Sparkles size={16} />
          Builder
        </button>
      </div>

      <p className="mb-1 text-[13px] uppercase tracking-[0.08em] text-slate-500">
        Available Packages
      </p>

      <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
        {isLoading ? (
          <>
            <Skeleton className="h-[62px] rounded-xl" />
            <Skeleton className="h-[62px] rounded-xl" />
            <Skeleton className="h-[62px] rounded-xl" />
          </>
        ) : filteredPackages.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-600">
            No packages available yet.
          </div>
        ) : (
          filteredPackages.map((pkg) => (
            <button
              key={pkg.title}
              type="button"
              onClick={() => onSelect(pkg)}
              className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-3 text-left transition-colors hover:bg-slate-50"
            >
              <div>
                <div className="text-sm font-semibold text-slate-900">{pkg.title}</div>
                <div className="text-xs text-slate-500">{pkg.description}</div>
              </div>
              <ChevronRight size={16} className="text-slate-400" />
            </button>
          ))
        )}
      </div>

      <div className="mt-4 flex justify-end">
        <Button className="border border-slate-300 bg-white text-slate-700 hover:bg-slate-50" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Box>
  );

  if (inline) return open ? content : null;

  return (
    <Dialog open={open} onClose={onClose} className="w-[min(560px,calc(100vw-32px))] p-5">
      {content}
    </Dialog>
  );
}
