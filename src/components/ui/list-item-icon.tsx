import type { AnyProps } from "@/utils/uiCompat";

export function ListItemIcon({ children, ...rest }: AnyProps) {
  return <span {...rest}>{children}</span>;
}
