import type React from "react";
import type { CSSProperties } from "react";

type SkeletonProps = React.HTMLAttributes<HTMLDivElement> & {
  width?: number | string;
  height?: number | string;
};

export function Skeleton({ width, height, style, ...rest }: SkeletonProps) {
  const sizeStyle: CSSProperties = { ...(width != null ? { width } : {}), ...(height != null ? { height } : {}) };
  return <div aria-hidden="true" style={{ ...sizeStyle, ...style }} {...rest} />;
}
