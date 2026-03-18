import type { AnyProps } from "./types";

export function ListItemText({ primary, secondary, ...rest }: AnyProps) {
  return (
    <span {...rest}>
      {primary}
      {secondary}
    </span>
  );
}
