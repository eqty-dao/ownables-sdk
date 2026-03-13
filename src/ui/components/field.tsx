import * as React from "react";
import { Field as BaseField } from "@base-ui/react/field";
import { Input } from "@base-ui/react/input";
import { cn } from "../lib/cn";

export function Field(props: BaseField.Root.Props) {
  return <BaseField.Root {...props} />;
}

export function FieldLabel(props: BaseField.Label.Props) {
  return <BaseField.Label {...props} />;
}

export function FieldDescription(props: BaseField.Description.Props) {
  return <BaseField.Description {...props} />;
}

export function FieldError(props: BaseField.Error.Props) {
  return <BaseField.Error {...props} />;
}

export const FieldInput = React.forwardRef<HTMLElement, React.ComponentPropsWithoutRef<typeof Input>>(
  ({ className, ...props }, ref) => {
    return <Input ref={ref} className={cn("w-full", className)} {...props} />;
  }
);

FieldInput.displayName = "FieldInput";
