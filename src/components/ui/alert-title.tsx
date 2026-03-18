import type { AnyProps } from "@/utils/uiCompat";

export function AlertTitle({ children, ...rest }: AnyProps) {
  return <strong {...rest}>{children}</strong>;
}
