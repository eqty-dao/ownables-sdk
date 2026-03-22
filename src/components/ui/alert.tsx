import type { ComponentPropsWithoutRef } from "react";

export type AlertColor = "success" | "info" | "warning" | "error" | "primary" | "secondary";

type AlertProps = ComponentPropsWithoutRef<"div"> & { severity?: AlertColor };

export function Alert({ children, severity, ...rest }: AlertProps) {
  return (
    <div role="alert" data-severity={severity} {...rest}>
      {children}
    </div>
  );
}
