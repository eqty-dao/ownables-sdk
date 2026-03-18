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
