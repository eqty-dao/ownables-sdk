import * as React from "react";
import { Button as BaseButton } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./lib/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-white text-slate-900 border border-slate-200 hover:bg-slate-50",
        primary: "bg-indigo-600 text-white hover:bg-indigo-700",
        secondary: "bg-slate-100 text-slate-700 hover:bg-slate-200",
        ghost: "bg-transparent text-slate-700 hover:bg-slate-100",
        danger: "bg-red-600 text-white hover:bg-red-700",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4",
        lg: "h-12 px-6 text-base",
      },
      iconOnly: {
        true: "h-10 w-10 p-0",
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
      iconOnly: false,
    },
  }
);

export type ButtonProps = React.ComponentPropsWithoutRef<typeof BaseButton> &
  VariantProps<typeof buttonVariants>;

export const Button = React.forwardRef<HTMLElement, ButtonProps>(
  ({ className, variant, size, iconOnly, ...props }, ref) => (
    <BaseButton ref={ref} className={cn(buttonVariants({ variant, size, iconOnly }), className)} {...props} />
  )
);

Button.displayName = "Button";
