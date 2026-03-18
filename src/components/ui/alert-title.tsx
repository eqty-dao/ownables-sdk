import type { ComponentPropsWithoutRef } from "react";

type AlertTitleProps = ComponentPropsWithoutRef<"strong">;

export function AlertTitle({ children, ...rest }: AlertTitleProps) {
  return <strong {...rest}>{children}</strong>;
}
