import type { ComponentPropsWithoutRef, ReactNode } from "react";

type ChipProps = ComponentPropsWithoutRef<"span"> & {
  label?: ReactNode;
  icon?: ReactNode;
};

export function Chip({ label, icon, children, ...rest }: ChipProps) {
  return (
    <span {...rest}>
      {icon}
      {label ?? children}
    </span>
  );
}
