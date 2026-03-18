import type { AnyProps } from "./types";

export function AlertTitle({ children, ...rest }: AnyProps) {
  return <strong {...rest}>{children}</strong>;
}
