import { forwardRef } from "react";
import type { AnyProps } from "./types";

export const Grid = forwardRef<HTMLDivElement, AnyProps>(function Grid({ children, ...rest }, ref) {
  return (
    <div ref={ref} {...rest}>
      {children}
    </div>
  );
});
