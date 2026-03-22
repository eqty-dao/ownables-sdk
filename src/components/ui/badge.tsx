import type { ComponentPropsWithoutRef, ReactNode } from "react";

type BadgeProps = ComponentPropsWithoutRef<"span"> & {
  badgeContent?: ReactNode;
  variant?: string;
};

export function Badge({ children, badgeContent, variant, ...rest }: BadgeProps) {
  return (
    <span {...rest}>
      {children}
      {variant === "dot" ? <span>•</span> : badgeContent != null ? <span>{badgeContent}</span> : null}
    </span>
  );
}
