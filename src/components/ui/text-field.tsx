import {
  forwardRef,
  type InputHTMLAttributes,
  type Ref,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "@/utils/cn";

type SharedProps = {
  className?: string;
  error?: boolean;
  helperText?: string;
  label?: string;
  multiline?: boolean;
  rows?: number;
};

type InputTextFieldProps = SharedProps & InputHTMLAttributes<HTMLInputElement>;
type TextareaTextFieldProps = SharedProps & TextareaHTMLAttributes<HTMLTextAreaElement>;

export type TextFieldProps = InputTextFieldProps | TextareaTextFieldProps;

export const TextField = forwardRef<HTMLInputElement | HTMLTextAreaElement, TextFieldProps>(function TextField(
  { className, label, helperText, error, multiline, rows = 3, ...rest },
  ref
) {
  return (
    <label className={cn("flex w-full flex-col gap-1", className)}>
      {label ? <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{label}</span> : null}
      {multiline ? (
        <textarea
          ref={ref as Ref<HTMLTextAreaElement>}
          rows={rows}
          className={cn(
            "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-slate-400",
            error ? "border-red-500" : ""
          )}
          {...(rest as TextareaHTMLAttributes<HTMLTextAreaElement>)}
        />
      ) : (
        <input
          ref={ref as Ref<HTMLInputElement>}
          className={cn(
            "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-slate-400",
            error ? "border-red-500" : ""
          )}
          {...(rest as InputHTMLAttributes<HTMLInputElement>)}
        />
      )}
      {helperText ? <small className={cn("text-xs text-slate-500 dark:text-slate-400", error ? "text-red-600 dark:text-red-400" : "")}>{helperText}</small> : null}
    </label>
  );
});
