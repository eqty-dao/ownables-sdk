import type { AnyProps } from "@/utils/uiCompat";
import { mergeStyle } from "@/utils/uiCompat";

export type AlertColor = "success" | "info" | "warning" | "error" | "primary" | "secondary";

export function Alert({ children, severity, sx, style, ...rest }: AnyProps) {
  return (
    <div role="alert" data-severity={severity} {...rest} style={mergeStyle(style, sx)}>
      {children}
    </div>
  );
}
