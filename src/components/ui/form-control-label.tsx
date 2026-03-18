import type { AnyProps } from "@/utils/uiCompat";

export function FormControlLabel({ control, label, ...rest }: AnyProps) {
  return (
    <label {...rest}>
      {control}
      {label}
    </label>
  );
}
