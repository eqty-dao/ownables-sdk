import { Button } from "@/components/ui";
import { Plus } from "lucide-react";
import { cva } from "class-variance-authority";
import { cn } from "../utils/cn";

const issueOwnableButton = cva(
  "mt-2 flex w-full items-start justify-start gap-3 rounded-[14px] border-2 p-4 border-dashed text-left transition-all",
  {
    variants: {
      selected: {
        true: "border-indigo-500 bg-indigo-50 shadow-md dark:bg-indigo-950/30",
        false: "border-slate-300 bg-transparent hover:border-indigo-400 dark:border-[#333333] dark:hover:border-indigo-500",
      },
      dimmed: {
        true: "cursor-not-allowed opacity-40",
        false: "",
      },
    },
    defaultVariants: { selected: false, dimmed: false },
  }
);

interface IssueOwnableButtonProps {
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}

export default function IssueOwnableButton({ selected, disabled, onClick }: IssueOwnableButtonProps) {
  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(issueOwnableButton({ selected, dimmed: disabled }))}
    >
      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[14px] bg-linear-to-br from-indigo-100 to-purple-100 transition-all hover:from-indigo-200 hover:to-purple-200 dark:from-indigo-900/30 dark:to-purple-900/30 dark:hover:from-indigo-800/40 dark:hover:to-purple-800/40">
        <Plus className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          Issue an Ownable
        </p>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
          Create a new ownable from a package
        </p>
      </div>
    </Button>
  );
}
