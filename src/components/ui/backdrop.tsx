import type { AnyProps } from "@/utils/uiCompat";
import { mergeStyle } from "@/utils/uiCompat";

export function Backdrop({ open, children, sx, style, ...rest }: AnyProps) {
  if (!open) return null;
  return (
    <div {...rest} style={mergeStyle(style, sx)}>
      {children}
    </div>
  );
}
