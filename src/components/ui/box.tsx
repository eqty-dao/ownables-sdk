import { forwardRef } from "react";
import type { AnyProps } from "@/utils/uiCompat";
import { asElement, mergeStyle, pickStyleProps } from "@/utils/uiCompat";

export type BoxProps = AnyProps;

export const Box = forwardRef<any, AnyProps>(function Box({ component, sx, style, ...rest }, ref) {
  const extracted = pickStyleProps(rest);
  const Component = asElement(component, "div");
  return <Component ref={ref} {...extracted.rest} style={mergeStyle({ ...style, ...extracted.style }, sx)} />;
});
