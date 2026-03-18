import { forwardRef, type ComponentPropsWithoutRef } from "react";

type StackProps = ComponentPropsWithoutRef<"div">;

export const Stack = forwardRef<HTMLDivElement, StackProps>(function Stack({ children, ...rest }, ref) {
  return (
    <div ref={ref} {...rest}>
      {children}
    </div>
  );
});
