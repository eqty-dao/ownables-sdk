import { forwardRef } from "react";
import { Switch as BaseSwitch } from "@base-ui/react";
import type { AnyProps } from "@/utils/uiCompat";

export const Switch = forwardRef<any, AnyProps>(function Switch({ checked, onChange, style, ...rest }, ref) {
  return (
    <BaseSwitch.Root
      ref={ref}
      checked={checked}
      onCheckedChange={(next: boolean) => onChange?.({ target: { checked: next } })}
      style={{
        position: "relative",
        display: "inline-flex",
        height: 24,
        width: 44,
        flexShrink: 0,
        borderRadius: 9999,
        background: checked ? "#0f172a" : "#cbd5e1",
        padding: 2,
        cursor: "pointer",
        transition: "background-color 160ms ease",
        ...(style || {}),
      }}
      {...rest}
    >
      <BaseSwitch.Thumb
        style={{
          display: "block",
          height: 20,
          width: 20,
          borderRadius: "50%",
          background: "#ffffff",
          boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
          transform: checked ? "translateX(20px)" : "translateX(0px)",
          transition: "transform 160ms ease",
        }}
      />
    </BaseSwitch.Root>
  );
});
