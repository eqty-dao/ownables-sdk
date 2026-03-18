import { forwardRef } from "react";
import { cn } from "@/utils/cn";
import { Button, type ButtonProps } from "./button";

export const IconButton = forwardRef<HTMLButtonElement, ButtonProps>(function IconButton(
  { className, size = "small", ...rest },
  ref
) {
  return <Button ref={ref} size={size} className={cn("h-9 w-9 p-0", className)} {...rest} />;
});
