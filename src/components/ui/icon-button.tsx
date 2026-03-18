import { forwardRef } from "react";
import type { AnyProps } from "@/utils/uiCompat";
import { Button } from "./button";

export const IconButton = forwardRef<any, AnyProps>(function IconButton(props, ref) {
  return <Button ref={ref} {...props} />;
});
