import type { AnyProps } from "./types";

export function ListItemIcon({ children, ...rest }: AnyProps) {
  return <span {...rest}>{children}</span>;
}
