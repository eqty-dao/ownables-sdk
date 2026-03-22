import { forwardRef, type ComponentPropsWithoutRef } from "react";

export type BoxProps = ComponentPropsWithoutRef<"div">;

export const Box = forwardRef<HTMLDivElement, BoxProps>(function Box({ children, ...rest }, ref) {
  return (
    <div ref={ref} {...rest}>
      {children}
    </div>
  );
});
