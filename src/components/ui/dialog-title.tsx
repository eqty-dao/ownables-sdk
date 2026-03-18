import type { AnyProps } from "@/utils/uiCompat";

export function DialogTitle({ children, ...rest }: AnyProps) {
  return <h2 {...rest}>{children}</h2>;
}
