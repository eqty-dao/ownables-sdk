import type { AnyProps } from "@/utils/uiCompat";
import { asElement, mergeStyle } from "@/utils/uiCompat";

export function Skeleton({ component, sx, style, ...rest }: AnyProps) {
  const Component = asElement(component, "div");
  return <Component aria-hidden="true" {...rest} style={mergeStyle(style, sx)} />;
}
