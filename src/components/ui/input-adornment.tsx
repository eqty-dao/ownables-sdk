import type { AnyProps } from "./types";

export function InputAdornment({ children, ...rest }: AnyProps) {
  return <span {...rest}>{children}</span>;
}
