import type { ComponentPropsWithoutRef } from "react";

type InputAdornmentProps = ComponentPropsWithoutRef<"span">;

export function InputAdornment({ children, ...rest }: InputAdornmentProps) {
  return <span {...rest}>{children}</span>;
}
