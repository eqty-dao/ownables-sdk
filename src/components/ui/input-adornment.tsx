import type { AnyProps } from "@/utils/uiCompat";

export function InputAdornment({ children, ...rest }: AnyProps) {
  return <span {...rest}>{children}</span>;
}
