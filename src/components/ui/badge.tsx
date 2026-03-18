import type React from "react";
import type { AnyProps } from "./types";

export function Badge({ children, badgeContent, variant, ...rest }: AnyProps & { badgeContent?: React.ReactNode; variant?: string }) {
  return (
    <span {...rest}>
      {children}
      {variant === "dot" ? <span>•</span> : badgeContent != null ? <span>{badgeContent}</span> : null}
    </span>
  );
}
