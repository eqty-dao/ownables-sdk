import type { AnyProps } from "@/utils/uiCompat";

export function DialogActions({ children, ...rest }: AnyProps) {
  return <div {...rest}>{children}</div>;
}
