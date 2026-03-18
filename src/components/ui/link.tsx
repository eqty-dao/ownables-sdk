import { forwardRef } from "react";
import type { AnyProps } from "@/utils/uiCompat";
import { mergeStyle } from "@/utils/uiCompat";

export const Link = forwardRef<any, AnyProps>(function Link({ sx, style, ...rest }, ref) {
  return <a ref={ref} {...rest} style={mergeStyle(style, sx)} />;
});
