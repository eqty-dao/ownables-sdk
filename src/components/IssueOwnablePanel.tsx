import { TypedPackage, TypedPackageStub } from "@/interfaces/TypedPackage";
import { Box, Button, Skeleton } from "@/components/ui";
import { ChevronRight, FolderUp, Package, Sparkles } from "lucide-react";
import { useService } from "@/hooks/useService";
import { usePackageManager } from "@/hooks/usePackageManager";
import { enqueueSnackbar } from "notistack";
import selectFile from "../utils/selectFile";
import { cva } from "class-variance-authority";
import { cn } from "@/utils/cn";
import Loading from "./Loading";

const actionButton = cva(
  "inline-flex flex-1 items-center justify-center gap-2 rounded-[14px] border border-gray-200 bg-white px-4 py-4 text-base font-medium text-slate-900 transition-colors hover:border-indigo-500 hover:shadow-md dark:border-[#333333] dark:bg-[#252525] dark:text-slate-100 dark:hover:border-indigo-500",
  {
    variants: {
      disabled: {
        true: "cursor-not-allowed opacity-50",
        false: "",
      },
    },
    defaultVariants: {
      disabled: false,
    },
  }
);

const packageCard = cva(
  "flex w-full flex-col items-start justify-start gap-0 p-4 rounded-xl border border-gray-200 dark:border-[#333333] bg-white dark:bg-[#252525] hover:border-indigo-500 dark:hover:border-indigo-500 hover:shadow-md transition-all text-left group"
);

interface IssueOwnablePanelProps {
  onSelect: (pkg: TypedPackage) => void;
  onImportFR: (pkg: TypedPackage[], triggerRefresh: boolean) => void;
  onError: (title: string, message: string) => void;
  onCreate: () => void;
  message: number;
}

export default function IssueOwnablePanel(props: IssueOwnablePanelProps) {
  const { onSelect, onImportFR, onError, onCreate, message } = props;
  const { packages, isLoading, importPackages, importInbox, downloadExample } = usePackageManager();
  const builderService = useService("builder");
  const hasBuilder = !!builderService;

  const filteredPackages = packages.filter((pkg) => !pkg.isNotLocal);

  const importAll = async () => {
    const files = await selectFile({ accept: ".zip", multiple: true });
    try {
      await importPackages(files);
      enqueueSnackbar("Packages imported successfully", { variant: "success" });
    } catch (error) {
      onError("Failed to import package", (error as Error).message || String(error));
    }
  };

  const importPackagesFromRelay = async () => {
    try {
      const result = await importInbox();
      if (result == null) return;
      const [filteredPkgs, triggerRefresh] = result as [Array<TypedPackage | undefined>, boolean];
      const validPackages = Array.isArray(filteredPkgs)
        ? filteredPkgs.filter((p): p is TypedPackage => p !== null && p !== undefined)
        : [];
      onImportFR(validPackages, triggerRefresh);
      enqueueSnackbar("Packages imported from relay", { variant: "success" });
    } catch (error) {
      onError("Failed to import ownable", (error as Error).message || String(error));
    }
  };

  const selectPackage = async (pkg: TypedPackage | TypedPackageStub) => {
    if ("stub" in pkg) {
      try {
        const downloadedPkg = await downloadExample(pkg.name);
        onSelect(downloadedPkg);
        enqueueSnackbar("Example package downloaded", { variant: "success" });
      } catch (error) {
        onError("Failed to import package", (error as Error).message || String(error));
        return;
      }
    } else {
      onSelect(pkg);
    }
  };

  return (
    <>
      <Box className="mx-auto max-w-2xl p-8">
        <Box className="surface-card p-8">
          {/* Heading */}
          <h2 className="mb-6 text-2xl font-bold text-slate-900 dark:text-white">
            Issue an Ownable
          </h2>

          {/* Action buttons — 2-column grid */}
          <div className="mb-8 grid grid-cols-2 gap-3">
            <Button
              type="button"
              className={cn(actionButton())}
              onClick={importAll}
            >
              <FolderUp size={20} className="text-slate-600 dark:text-slate-400" />
              Upload Package
            </Button>
            {message > 0 ? (
              <Button
                type="button"
                className={cn(actionButton())}
                onClick={importPackagesFromRelay}
              >
                <FolderUp size={20} className="text-slate-600 dark:text-slate-400" />
                From Relay ({message})
              </Button>
            ) : (
              <Button
                type="button"
                className={cn(actionButton({ disabled: !hasBuilder }))}
                onClick={onCreate}
                disabled={!hasBuilder}
              >
                <Sparkles size={20} className="text-slate-600 dark:text-slate-400" />
                Ownable Builder
              </Button>
            )}
          </div>

          {/* Section label */}
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.05em] text-slate-500 dark:text-slate-400">
            Available Packages
          </h3>

          {/* Package grid — 2 columns */}
          <div className="grid grid-cols-2 gap-3">
            {isLoading ? (
              <>
                <Skeleton className="h-[120px] rounded-xl" />
                <Skeleton className="h-[120px] rounded-xl" />
                <Skeleton className="h-[120px] rounded-xl" />
                <Skeleton className="h-[120px] rounded-xl" />
              </>
            ) : filteredPackages.length === 0 ? (
              <div className="surface-muted col-span-2 px-3 py-4 text-sm">
                No packages available yet.
              </div>
            ) : (
              filteredPackages.map((pkg) => (
                <Button
                  key={pkg.title}
                  type="button"
                  onClick={() => selectPackage(pkg)}
                  className={cn(packageCard())}
                >
                  {/* Top row: icon + chevron */}
                  <div className="flex w-full items-center justify-between">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30">
                      <Package size={20} className="text-indigo-500 dark:text-indigo-400" />
                    </div>
                    <ChevronRight size={20} className="text-slate-300 dark:text-slate-600" />
                  </div>
                  {/* Title */}
                  <p className="mt-2 text-sm font-semibold leading-5 text-slate-900 dark:text-slate-100">
                    {pkg.title}
                  </p>
                  {/* Description */}
                  <p className="mt-0.5 text-xs font-medium leading-4 text-slate-500 dark:text-slate-400">
                    {pkg.description}
                  </p>
                </Button>
              ))
            )}
          </div>
        </Box>
      </Box>
      <Loading show={isLoading} />
    </>
  );
}
