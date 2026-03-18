import type { AnyProps } from "./types";

export type TooltipProps = AnyProps;

export function Tooltip({ title, children, ...rest }: AnyProps) {
  return (
    <span title={typeof title === "string" ? title : undefined} {...rest}>
      {children}
    </span>
  );
}
