import { forwardRef } from "react";
import { Upload } from "lucide-react";
import { cva } from "class-variance-authority";
import { cn } from "@/utils/cn";

const fileInput = cva(
  [
    "flex cursor-pointer items-center gap-3 rounded-xl border border-dashed px-4 py-3 text-sm transition-colors",
    "border-slate-300 bg-slate-50 hover:border-indigo-400 hover:bg-indigo-50/50",
    "dark:border-[#333] dark:bg-[#1e1e1e] dark:hover:border-indigo-500 dark:hover:bg-indigo-950/10",
  ],
  {
    variants: {
      disabled: {
        true: "cursor-not-allowed opacity-50",
        false: "",
      },
    },
    defaultVariants: { disabled: false },
  }
);

export interface FileInputProps {
  accept?: string;
  disabled?: boolean;
  fileName?: string;
  placeholder?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
}

export const FileInput = forwardRef<HTMLInputElement, FileInputProps>(
  ({ accept, disabled, fileName, placeholder = "Choose file…", onChange, className }, ref) => (
    <label className={cn(fileInput({ disabled: !!disabled }), className)}>
      <Upload className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
      <span className={cn("truncate", fileName ? "text-slate-900 dark:text-slate-100" : "text-slate-400 dark:text-slate-500")}>
        {fileName || placeholder}
      </span>
      <input
        ref={ref}
        type="file"
        accept={accept}
        disabled={disabled}
        onChange={onChange}
        className="sr-only"
      />
    </label>
  )
);

FileInput.displayName = "FileInput";
