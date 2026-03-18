import type { AnyProps } from "@/utils/uiCompat";

export function DialogContent({ children, ...rest }: AnyProps) {
  return <div {...rest}>{children}</div>;
}
