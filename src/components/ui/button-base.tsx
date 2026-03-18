import { forwardRef } from "react";
import type { AnyProps } from "@/utils/uiCompat";
import { Button } from "./button";

export const ButtonBase = forwardRef<any, AnyProps>(function ButtonBase(props, ref) {
  return <Button ref={ref} {...props} />;
});
