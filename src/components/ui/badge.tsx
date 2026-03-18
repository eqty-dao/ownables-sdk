import type { AnyProps } from "@/utils/uiCompat";

export function Badge({ children, badgeContent, variant, ...rest }: AnyProps) {
  return (
    <span {...rest}>
      {children}
      {variant === "dot" ? <span>•</span> : badgeContent != null ? <span>{badgeContent}</span> : null}
    </span>
  );
}
