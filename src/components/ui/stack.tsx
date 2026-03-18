import { forwardRef } from "react";
import type { AnyProps } from "@/utils/uiCompat";
import { asElement, mergeStyle, pickStyleProps } from "@/utils/uiCompat";

export const Stack = forwardRef<any, AnyProps>(function Stack({ component, sx, style, ...rest }, ref) {
  const extracted = pickStyleProps(rest);
  const Component = asElement(component, "div");
  return <Component ref={ref} {...extracted.rest} style={mergeStyle({ ...style, ...extracted.style }, sx)} />;
});
