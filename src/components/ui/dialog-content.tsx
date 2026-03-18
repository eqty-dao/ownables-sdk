import type { AnyProps } from "./types";

export function DialogContent({ children, ...rest }: AnyProps) {
  return <div {...rest}>{children}</div>;
}
