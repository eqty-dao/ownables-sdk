import type { AnyProps } from "./types";

export function Menu({ open, children, onClose, ...rest }: AnyProps) {
  if (!open) return null;
  return (
    <div {...rest}>
      <button type="button" onClick={onClose} aria-label="Close menu" />
      {children}
    </div>
  );
}

export function MenuItem({ children, onClick, ...rest }: AnyProps) {
  return (
    <button type="button" {...rest} onClick={onClick}>
      {children}
    </button>
  );
}
