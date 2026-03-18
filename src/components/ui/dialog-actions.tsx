import type { AnyProps } from "./types";

export function DialogActions({ children, ...rest }: AnyProps) {
  return <div {...rest}>{children}</div>;
}
