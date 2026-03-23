import type { ComponentPropsWithoutRef, ReactNode } from "react";

export type AlertColor = "success" | "info" | "warning" | "error" | "primary" | "secondary";

type AlertProps = Omit<ComponentPropsWithoutRef<"div">, "onClose"> & {
  severity?: AlertColor;
  icon?: ReactNode;
  onClose?: () => void;
};

export function Alert({ children, severity, icon, onClose, ...rest }: AlertProps) {
  return (
    <div role="alert" data-severity={severity} {...rest}>
      {icon}
      {children}
      {onClose && <button type="button" onClick={onClose} aria-label="close" />}
    </div>
  );
}
