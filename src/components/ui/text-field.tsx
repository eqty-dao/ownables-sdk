import { forwardRef } from "react";
import type { AnyProps } from "@/utils/uiCompat";
import { mergeStyle } from "@/utils/uiCompat";

export type TextFieldProps = AnyProps;

export const TextField = forwardRef<any, AnyProps>(function TextField(
  { label, helperText, error, InputProps, multiline, rows, sx, style, ...rest },
  ref
) {
  const InputTag: any = multiline ? "textarea" : "input";
  return (
    <label style={mergeStyle(style, sx)}>
      {label ? <span>{label}</span> : null}
      <span>
        <InputTag ref={ref} rows={rows} {...rest} />
        {InputProps?.endAdornment}
      </span>
      {helperText ? <small data-error={!!error}>{helperText}</small> : null}
    </label>
  );
});
