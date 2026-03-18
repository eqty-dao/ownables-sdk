import { forwardRef } from "react";
import type { AnyProps } from "./types";

export const Paper = forwardRef<HTMLDivElement, AnyProps>(function Paper({ children, ...rest }, ref) {
  return (
    <div ref={ref} {...rest}>
      {children}
    </div>
  );
});
