import type React from "react";
import type { AnyProps } from "./types";

export function Chip({ label, icon, children, ...rest }: AnyProps & { label?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <span {...rest}>
      {icon}
      {label ?? children}
    </span>
  );
}
