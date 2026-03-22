import type { ComponentPropsWithoutRef } from "react";

export type TooltipProps = ComponentPropsWithoutRef<"span"> & {
  title?: string;
};

export function Tooltip({ title, children, ...rest }: TooltipProps) {
  return (
    <span title={typeof title === "string" ? title : undefined} {...rest}>
      {children}
    </span>
  );
}
