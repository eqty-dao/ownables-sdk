import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/utils/cn";

const tileVariants = cva(
  "inline-flex items-center justify-center rounded-xl border",
  {
    variants: {
      variant: {
        neutral: "border-slate-200 bg-slate-50 text-slate-500",
        brand: "border-indigo-200 bg-gradient-to-br from-indigo-100 to-purple-100 text-indigo-500",
        success: "border-emerald-200 bg-emerald-50 text-emerald-600",
        warning: "border-amber-200 bg-amber-50 text-amber-600",
      },
      size: {
        sm: "h-8 w-8",
        md: "h-12 w-12",
        lg: "h-16 w-16",
      },
    },
    defaultVariants: {
      variant: "neutral",
      size: "md",
    },
  }
);

export type TileProps = React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof tileVariants> & {
    icon?: React.ReactNode;
    children?: React.ReactNode;
  };

export function Tile({ className, variant, size, icon, children, ...props }: TileProps) {
  return (
    <div className={cn(tileVariants({ variant, size }), className)} {...props}>
      {children ?? icon}
    </div>
  );
}

