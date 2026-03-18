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
      {label ? <span className="text-sm font-medium">{label}</span> : null}
      {multiline ? (
        <textarea
          ref={ref as Ref<HTMLTextAreaElement>}
          rows={rows}
          className={cn(
            "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-slate-500",
            error ? "border-red-500" : ""
          )}
          {...(rest as TextareaHTMLAttributes<HTMLTextAreaElement>)}
        />
      ) : (
        <input
          ref={ref as Ref<HTMLInputElement>}
          className={cn(
            "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-slate-500",
            error ? "border-red-500" : ""
          )}
          {...(rest as InputHTMLAttributes<HTMLInputElement>)}
        />
      )}
      {helperText ? <small className={cn("text-xs text-slate-500", error ? "text-red-600" : "")}>{helperText}</small> : null}
    </label>
  );
});
