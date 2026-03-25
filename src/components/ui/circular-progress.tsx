import type { ComponentPropsWithoutRef, CSSProperties } from "react";

type CircularProgressProps = ComponentPropsWithoutRef<"span"> & { size?: number | string };

export function CircularProgress({ size, style, ...rest }: CircularProgressProps) {
  const sizeStyle: CSSProperties = size != null ? { width: size, height: size } : {};
  return <span role="progressbar" style={{ ...sizeStyle, ...style }} {...rest} />;
}
