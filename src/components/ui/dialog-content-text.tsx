import type { AnyProps } from "./types";

export function DialogContentText({ children, ...rest }: AnyProps) {
  return <p {...rest}>{children}</p>;
}
