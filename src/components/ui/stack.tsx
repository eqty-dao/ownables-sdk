import { forwardRef } from "react";
import type { AnyProps } from "./types";

export const Stack = forwardRef<HTMLDivElement, AnyProps>(function Stack({ children, ...rest }, ref) {
  return (
    <div ref={ref} {...rest}>
      {children}
    </div>
  );
});
