import type React from "react";

export type AnyProps = Record<string, any>;

const fakeTheme = {
  palette: {
    primary: { main: "#000", dark: "#000", contrastText: "#fff" },
    secondary: { main: "#666" },
    text: { primary: "#000", secondary: "#666" },
    background: { paper: "#fff" },
  },
  zIndex: { modal: 1300 },
};

export function createTheme(theme: AnyProps) {
  return { ...fakeTheme, ...theme };
}

function normalizeSxValue(value: any): any {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const responsiveKeys = ["xs", "sm", "md", "lg", "xl"];
    const hasResponsive = Object.keys(value).some((k) => responsiveKeys.includes(k));
    if (hasResponsive) {
      return value.xs ?? value.sm ?? value.md ?? value.lg ?? value.xl;
    }
  }
  return value;
}

export function sxToStyle(sx: any): React.CSSProperties {
  if (!sx) return {};
  if (Array.isArray(sx)) {
    return sx.reduce((acc, item) => ({ ...acc, ...sxToStyle(item) }), {} as React.CSSProperties);
  }
  if (typeof sx === "function") {
    return sxToStyle(sx(fakeTheme));
  }
  if (typeof sx === "object") {
    const out: Record<string, any> = {};
    for (const [key, raw] of Object.entries(sx)) {
      const value = normalizeSxValue(raw);
      if (value == null || typeof value === "object") continue;
      out[key] = value;
    }
    return out as React.CSSProperties;
  }
  return {};
}

export function mergeStyle(style: any, sx: any): React.CSSProperties {
  return { ...(style || {}), ...sxToStyle(sx) };
}

export function spacingValue(value: any): string | undefined {
  if (value == null) return undefined;
  if (typeof value === "number") return `${value * 8}px`;
  return String(value);
}

export function pickStyleProps(props: AnyProps): { style: React.CSSProperties; rest: AnyProps } {
  const rest = { ...props };
  const style: Record<string, any> = {};
  const styleKeys = [
    "display",
    "justifyContent",
    "alignItems",
    "minHeight",
    "minWidth",
    "height",
    "width",
    "maxWidth",
    "maxHeight",
    "overflow",
    "overflowX",
    "overflowY",
    "padding",
    "paddingTop",
    "paddingBottom",
    "paddingLeft",
    "paddingRight",
    "margin",
    "marginTop",
    "marginBottom",
    "marginLeft",
    "marginRight",
    "textAlign",
    "fontSize",
    "fontWeight",
    "lineHeight",
    "color",
    "backgroundColor",
    "border",
    "borderRadius",
    "flex",
    "flexGrow",
    "flexShrink",
    "flexBasis",
    "gap",
  ];

  for (const key of styleKeys) {
    if (rest[key] !== undefined) {
      style[key] = rest[key];
      delete rest[key];
    }
  }

  return { style: style as React.CSSProperties, rest };
}

export function asElement(component: any, fallback: any) {
  return component || fallback;
}
