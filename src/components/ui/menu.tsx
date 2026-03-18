import type { ComponentPropsWithoutRef } from "react";

type MenuProps = Omit<ComponentPropsWithoutRef<"div">, "onClose"> & {
  open?: boolean;
  onClose?: () => void;
};
type MenuItemProps = ComponentPropsWithoutRef<"button">;

export function Menu({ open, children, onClose, ...rest }: MenuProps) {
  if (!open) return null;
  return (
    <div {...rest}>
      <button type="button" onClick={onClose} aria-label="Close menu" />
      {children}
    </div>
  );
}

export function MenuItem({ children, onClick, ...rest }: MenuItemProps) {
  return (
    <button type="button" {...rest} onClick={onClick}>
      {children}
    </button>
  );
}
