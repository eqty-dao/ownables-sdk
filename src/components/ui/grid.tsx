import { forwardRef, type CSSProperties } from "react";
import type { AnyProps } from "@/utils/uiCompat";
import { asElement, mergeStyle, pickStyleProps, spacingValue } from "@/utils/uiCompat";

export const Grid = forwardRef<any, AnyProps>(function Grid(
  {
    component,
    sx,
    style,
    container,
    item,
    spacing,
    direction,
    xs,
    sm,
    md,
    lg,
    xl,
    rowSpacing,
    columnSpacing,
    ...rest
  },
  ref
) {
  const extracted = pickStyleProps(rest);
  const gridStyle: CSSProperties = {
    ...extracted.style,
  };

  if (container) {
    gridStyle.display = "flex";
    gridStyle.flexWrap = "wrap";
    if (direction) gridStyle.flexDirection = direction;
    if (spacing !== undefined) gridStyle.gap = spacingValue(spacing);
    if (rowSpacing !== undefined) gridStyle.rowGap = spacingValue(rowSpacing);
    if (columnSpacing !== undefined) gridStyle.columnGap = spacingValue(columnSpacing);
  }

  if (item) {
    const span = xs ?? sm ?? md ?? lg ?? xl;
    if (typeof span === "number" && span > 0) {
      const widthPct = `${(span / 12) * 100}%`;
      gridStyle.width = widthPct;
      gridStyle.flexBasis = widthPct;
      gridStyle.maxWidth = widthPct;
    }
  }

  const Component = asElement(component, "div");
  return <Component ref={ref} {...extracted.rest} style={mergeStyle({ ...style, ...gridStyle }, sx)} />;
});
