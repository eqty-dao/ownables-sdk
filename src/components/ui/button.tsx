import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/utils/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
  {
    variants: {
      variant: {
        primary: "rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800",
        danger: "rounded-xl bg-red-600 text-white hover:bg-red-700 active:bg-red-800",
        "danger-outlined": "rounded-xl border-2 border-red-600 bg-transparent text-red-600 hover:bg-red-50 active:bg-red-100 dark:hover:bg-red-950/20",
        ghost: "rounded-xl bg-transparent text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-[#2a2a2a]",
      },
      size: {
        small: "text-sm px-2 py-1",
        medium: "text-sm",
        large: "text-base px-4 py-3",
      },
    },
    defaultVariants: {
      size: "medium",
    },
  }
);

type ButtonBaseProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "color">;
export type ButtonProps = ButtonBaseProps & VariantProps<typeof buttonVariants>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, size, variant, type = "button", ...rest },
  ref
) {
  return <button ref={ref} type={type} className={cn(buttonVariants({ size, variant }), className)} {...rest} />;
});
