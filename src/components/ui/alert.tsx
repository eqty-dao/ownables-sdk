import type { AnyProps } from "./types";

export type AlertColor = "success" | "info" | "warning" | "error" | "primary" | "secondary";

export function Alert({ children, severity, ...rest }: AnyProps & { severity?: AlertColor }) {
  return (
    <div role="alert" data-severity={severity} {...rest}>
      {children}
    </div>
  );
}
