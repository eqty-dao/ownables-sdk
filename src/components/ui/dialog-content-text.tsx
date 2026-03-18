import type { AnyProps } from "@/utils/uiCompat";

export function DialogContentText({ children, ...rest }: AnyProps) {
  return <p {...rest}>{children}</p>;
}
