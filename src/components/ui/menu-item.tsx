import type { AnyProps } from "./types";

export function MenuItem({ children, onClick, ...rest }: AnyProps) {
  return (
    <button type="button" {...rest} onClick={onClick}>
      {children}
    </button>
  );
}
