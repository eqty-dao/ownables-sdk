import type { AnyProps } from "@/utils/uiCompat";

export function MenuItem({ children, onClick, ...rest }: AnyProps) {
  return (
    <button type="button" {...rest} onClick={onClick}>
      {children}
    </button>
  );
}
