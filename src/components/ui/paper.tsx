import { forwardRef, type ComponentPropsWithoutRef } from "react";

type PaperProps = ComponentPropsWithoutRef<"div">;

export const Paper = forwardRef<HTMLDivElement, PaperProps>(function Paper({ children, ...rest }, ref) {
  return (
    <div ref={ref} {...rest}>
      {children}
    </div>
  );
});
