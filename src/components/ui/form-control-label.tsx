import type { ComponentPropsWithoutRef, ReactNode } from "react";

type FormControlLabelProps = Omit<ComponentPropsWithoutRef<"label">, "children"> & {
  control?: ReactNode;
  label?: ReactNode;
};

export function FormControlLabel({ control, label, ...rest }: FormControlLabelProps) {
  return (
    <label {...rest}>
      {control}
      {label}
    </label>
  );
}
