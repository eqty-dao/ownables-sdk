import { forwardRef } from "react";
import type { AnyProps } from "@/utils/uiCompat";
import { asElement, mergeStyle, pickStyleProps } from "@/utils/uiCompat";

export const Typography = forwardRef<any, AnyProps>(function Typography(
  { component, variant, sx, style, children, ...rest },
  ref
) {
  const extracted = pickStyleProps(rest);
  const fallback = variant && String(variant).startsWith("h") ? variant : "span";
  const Component = asElement(component, fallback);
  return (
    <Component ref={ref} {...extracted.rest} style={mergeStyle({ ...style, ...extracted.style }, sx)}>
      {children}
    </Component>
  );
});
