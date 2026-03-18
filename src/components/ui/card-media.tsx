import { forwardRef } from "react";
import type { AnyProps } from "@/utils/uiCompat";
import { asElement, mergeStyle } from "@/utils/uiCompat";

export const CardMedia = forwardRef<any, AnyProps>(function CardMedia(
  { component, image, src, sx, style, ...rest },
  ref
) {
  const Component = asElement(component, "img");
  if (Component === "img") {
    return <img ref={ref} src={src || image} {...rest} style={mergeStyle(style, sx)} />;
  }
  return <Component ref={ref} {...rest} style={mergeStyle(style, sx)} />;
});
