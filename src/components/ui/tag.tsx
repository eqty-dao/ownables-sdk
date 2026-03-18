import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/utils/cn";

const tagVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        neutral: "border-slate-200 bg-slate-50 text-slate-700",
        locked: "border-red-200 bg-red-50 text-red-700",
        unlocked: "border-emerald-200 bg-emerald-50 text-emerald-700",
        consumable: "border-amber-200 bg-amber-50 text-amber-700",
      },
      color: {
        default: "",
        success: "border-emerald-200 bg-emerald-50 text-emerald-700",
        warning: "border-amber-200 bg-amber-50 text-amber-700",
        danger: "border-red-200 bg-red-50 text-red-700",
        info: "border-sky-200 bg-sky-50 text-sky-700",
      },
    },
    defaultVariants: {
      variant: "neutral",
      color: "default",
    },
  }
);

export type TagProps = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof tagVariants> & {
    icon?: React.ReactNode;
    value: React.ReactNode;
  };

export function Tag({ className, variant, color, icon, value, ...props }: TagProps) {
  return (
    <span className={cn(tagVariants({ variant, color }), className)} {...props}>
      {icon}
      <span>{value}</span>
    </span>
  );
}

