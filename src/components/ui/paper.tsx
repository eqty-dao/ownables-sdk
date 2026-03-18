import { forwardRef } from "react";
import type { AnyProps } from "@/utils/uiCompat";
import { asElement, mergeStyle } from "@/utils/uiCompat";

export const Paper = forwardRef<any, AnyProps>(function Paper({ component, sx, style, ...rest }, ref) {
  const Component = asElement(component, "div");
  return <Component ref={ref} {...rest} style={mergeStyle(style, sx)} />;
});
