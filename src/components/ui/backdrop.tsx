import type { AnyProps } from "./types";

export function Backdrop({ open, children, ...rest }: AnyProps & { open?: boolean }) {
  if (!open) return null;
  return <div {...rest}>{children}</div>;
}
