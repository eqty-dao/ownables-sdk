import { forwardRef, type CSSProperties } from "react";
import type { AnyProps } from "@/utils/uiCompat";
import { mergeStyle, pickStyleProps } from "@/utils/uiCompat";

export const Button = forwardRef<any, AnyProps>(function Button(
  { sx, style, type = "button", fullWidth, variant, color, size, ...rest },
  ref
) {
  const extracted = pickStyleProps(rest);
  if (fullWidth) extracted.style.width = "100%";
  const variantName = variant || "text";
  const colorName = color || "primary";
  const baseStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: size === "small" ? "6px 10px" : size === "large" ? "12px 18px" : "8px 14px",
    borderRadius: 10,
    border: "1px solid transparent",
    cursor: "pointer",
    fontWeight: 600,
    lineHeight: 1.2,
  };

  const primaryStyles: Record<string, CSSProperties> = {
    text: { color: "#0f172a", background: "transparent" },
    outlined: { color: "#0f172a", background: "#ffffff", borderColor: "#cbd5e1" },
    contained: { color: "#ffffff", background: "#0f172a" },
  };
  const secondaryStyles: Record<string, CSSProperties> = {
    text: { color: "#334155", background: "transparent" },
    outlined: { color: "#334155", background: "#ffffff", borderColor: "#cbd5e1" },
    contained: { color: "#ffffff", background: "#475569" },
  };
  const warningStyles: Record<string, CSSProperties> = {
    text: { color: "#92400e", background: "transparent" },
    outlined: { color: "#92400e", background: "#ffffff", borderColor: "#fbbf24" },
    contained: { color: "#ffffff", background: "#d97706" },
  };
  const errorStyles: Record<string, CSSProperties> = {
    text: { color: "#b91c1c", background: "transparent" },
    outlined: { color: "#b91c1c", background: "#ffffff", borderColor: "#fca5a5" },
    contained: { color: "#ffffff", background: "#dc2626" },
  };
  const palette =
    colorName === "error"
      ? errorStyles
      : colorName === "warning"
        ? warningStyles
        : colorName === "secondary"
          ? secondaryStyles
          : primaryStyles;
  const variantStyle = palette[variantName] || primaryStyles.text;

  return (
    <button
      ref={ref}
      type={type}
      {...extracted.rest}
      style={mergeStyle({ ...baseStyle, ...variantStyle, ...style, ...extracted.style }, sx)}
    />
  );
});
