import type { AnyProps } from "@/utils/uiCompat";
import { mergeStyle } from "@/utils/uiCompat";

export function Chip({ label, icon, children, sx, style, ...rest }: AnyProps) {
  return (
    <span {...rest} style={mergeStyle(style, sx)}>
      {icon}
      {label ?? children}
    </span>
  );
}
