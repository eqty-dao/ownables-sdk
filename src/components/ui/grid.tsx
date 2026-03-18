import { forwardRef, type ComponentPropsWithoutRef } from "react";

type GridProps = ComponentPropsWithoutRef<"div">;

export const Grid = forwardRef<HTMLDivElement, GridProps>(function Grid({ children, ...rest }, ref) {
  return (
    <div ref={ref} {...rest}>
      {children}
    </div>
  );
});
