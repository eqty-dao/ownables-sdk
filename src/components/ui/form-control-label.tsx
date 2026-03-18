import type { AnyProps } from "./types";

export function FormControlLabel({ control, label, ...rest }: AnyProps) {
  return (
    <label {...rest}>
      {control}
      {label}
    </label>
  );
}
