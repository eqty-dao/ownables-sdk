import type { AnyProps } from "./types";

export function DialogTitle({ children, ...rest }: AnyProps) {
  return <h2 {...rest}>{children}</h2>;
}
