import type { ComponentPropsWithoutRef } from "react";

type BackdropProps = ComponentPropsWithoutRef<"div"> & { open?: boolean };

export function Backdrop({ open, children, ...rest }: BackdropProps) {
  if (!open) return null;
  return <div {...rest}>{children}</div>;
}
