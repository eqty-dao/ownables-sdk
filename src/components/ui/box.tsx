import { forwardRef } from "react";
import type { AnyProps } from "./types";

export type BoxProps = AnyProps;

export const Box = forwardRef<HTMLDivElement, AnyProps>(function Box({ children, ...rest }, ref) {
  return (
    <div ref={ref} {...rest}>
      {children}
    </div>
  );
});
