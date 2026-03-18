import React, { forwardRef } from "react";
import { Dialog as BaseDialog, Drawer as BaseDrawer, Switch as BaseSwitch } from "@base-ui/react";
export { Tag, type TagProps } from "./tag";
export { Tile, type TileProps } from "./tile";

type AnyProps = Record<string, any>;

export type AlertColor = "success" | "info" | "warning" | "error" | "primary" | "secondary";
export type BoxProps = AnyProps;
export type TextFieldProps = AnyProps;
export type TooltipProps = AnyProps;

const fakeTheme = {
  palette: {
    primary: { main: "#000", dark: "#000", contrastText: "#fff" },
    secondary: { main: "#666" },
    text: { primary: "#000", secondary: "#666" },
    background: { paper: "#fff" },
  },
  zIndex: { modal: 1300 },
};

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

function sxToStyle(sx: any): React.CSSProperties {
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

function mergeStyle(style: any, sx: any): React.CSSProperties {
  return { ...(style || {}), ...sxToStyle(sx) };
}

function spacingValue(value: any): string | undefined {
  if (value == null) return undefined;
  if (typeof value === "number") return `${value * 8}px`;
  return String(value);
}

function pickStyleProps(props: AnyProps): { style: React.CSSProperties; rest: AnyProps } {
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

function asElement(component: any, fallback: any) {
  return component || fallback;
}

export const ThemeProvider = ({ children }: AnyProps) => <>{children}</>;
export const createTheme = (theme: AnyProps) => ({ ...fakeTheme, ...theme });

export const Box = forwardRef<any, AnyProps>(function Box({ component, sx, style, ...rest }, ref) {
  const extracted = pickStyleProps(rest);
  const Component = asElement(component, "div");
  return <Component ref={ref} {...extracted.rest} style={mergeStyle({ ...style, ...extracted.style }, sx)} />;
});

export const Stack = forwardRef<any, AnyProps>(function Stack({ component, sx, style, ...rest }, ref) {
  const extracted = pickStyleProps(rest);
  const Component = asElement(component, "div");
  return <Component ref={ref} {...extracted.rest} style={mergeStyle({ ...style, ...extracted.style }, sx)} />;
});

export const Grid = forwardRef<any, AnyProps>(function Grid(
  {
    component,
    sx,
    style,
    container,
    item,
    spacing,
    direction,
    xs,
    sm,
    md,
    lg,
    xl,
    rowSpacing,
    columnSpacing,
    ...rest
  },
  ref
) {
  const extracted = pickStyleProps(rest);
  const gridStyle: React.CSSProperties = {
    ...extracted.style,
  };

  if (container) {
    gridStyle.display = "flex";
    gridStyle.flexWrap = "wrap";
    if (direction) gridStyle.flexDirection = direction;
    if (spacing !== undefined) gridStyle.gap = spacingValue(spacing);
    if (rowSpacing !== undefined) gridStyle.rowGap = spacingValue(rowSpacing);
    if (columnSpacing !== undefined) gridStyle.columnGap = spacingValue(columnSpacing);
  }

  if (item) {
    const span = xs ?? sm ?? md ?? lg ?? xl;
    if (typeof span === "number" && span > 0) {
      const widthPct = `${(span / 12) * 100}%`;
      gridStyle.width = widthPct;
      gridStyle.flexBasis = widthPct;
      gridStyle.maxWidth = widthPct;
    }
  }

  const Component = asElement(component, "div");
  return <Component ref={ref} {...extracted.rest} style={mergeStyle({ ...style, ...gridStyle }, sx)} />;
});

export const Typography = forwardRef<any, AnyProps>(function Typography(
  { component, variant, sx, style, children, ...rest },
  ref
) {
  const extracted = pickStyleProps(rest);
  const fallback = variant && String(variant).startsWith("h") ? variant : "span";
  const Component = asElement(component, fallback);
  return (
    <Component ref={ref} {...extracted.rest} style={mergeStyle({ ...style, ...extracted.style }, sx)}>
      {children}
    </Component>
  );
});

export const Link = forwardRef<any, AnyProps>(function Link({ sx, style, ...rest }, ref) {
  return <a ref={ref} {...rest} style={mergeStyle(style, sx)} />;
});

export const Button = forwardRef<any, AnyProps>(function Button(
  { sx, style, type = "button", fullWidth, variant, color, size, ...rest },
  ref
) {
  const extracted = pickStyleProps(rest);
  if (fullWidth) extracted.style.width = "100%";
  const variantName = variant || "text";
  const colorName = color || "primary";
  const baseStyle: React.CSSProperties = {
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

  const primaryStyles: Record<string, React.CSSProperties> = {
    text: { color: "#0f172a", background: "transparent" },
    outlined: { color: "#0f172a", background: "#ffffff", borderColor: "#cbd5e1" },
    contained: { color: "#ffffff", background: "#0f172a" },
  };
  const secondaryStyles: Record<string, React.CSSProperties> = {
    text: { color: "#334155", background: "transparent" },
    outlined: { color: "#334155", background: "#ffffff", borderColor: "#cbd5e1" },
    contained: { color: "#ffffff", background: "#475569" },
  };
  const warningStyles: Record<string, React.CSSProperties> = {
    text: { color: "#92400e", background: "transparent" },
    outlined: { color: "#92400e", background: "#ffffff", borderColor: "#fbbf24" },
    contained: { color: "#ffffff", background: "#d97706" },
  };
  const errorStyles: Record<string, React.CSSProperties> = {
    text: { color: "#b91c1c", background: "transparent" },
    outlined: { color: "#b91c1c", background: "#ffffff", borderColor: "#fca5a5" },
    contained: { color: "#ffffff", background: "#dc2626" },
  };
  const palette =
    colorName === "error" ? errorStyles : colorName === "warning" ? warningStyles : colorName === "secondary" ? secondaryStyles : primaryStyles;
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

export const IconButton = forwardRef<any, AnyProps>(function IconButton(props, ref) {
  return <Button ref={ref} {...props} />;
});

export const ButtonBase = forwardRef<any, AnyProps>(function ButtonBase(props, ref) {
  return <Button ref={ref} {...props} />;
});

export const Paper = forwardRef<any, AnyProps>(function Paper({ component, sx, style, ...rest }, ref) {
  const Component = asElement(component, "div");
  return <Component ref={ref} {...rest} style={mergeStyle(style, sx)} />;
});

export const Card = Paper;
export const CardContent = Paper;
export const CardActions = Paper;
export const AppBar = Paper;
export const Toolbar = Paper;

export const CardMedia = forwardRef<any, AnyProps>(function CardMedia(
  { component, image, src, sx, style, ...rest },
  ref
) {
  const Component = asElement(component, "img");
  if (Component === "img") {
    return <img ref={ref} src={src || image} {...rest} style={mergeStyle(style, sx)} />;
  }
  return <Component ref={ref} {...rest} style={mergeStyle(style, sx)} />;
});

export const Badge = ({ children, badgeContent, variant, ...rest }: AnyProps) => (
  <span {...rest}>
    {children}
    {variant === "dot" ? <span>•</span> : badgeContent != null ? <span>{badgeContent}</span> : null}
  </span>
);

export const Chip = ({ label, icon, children, sx, style, ...rest }: AnyProps) => (
  <span {...rest} style={mergeStyle(style, sx)}>
    {icon}
    {label ?? children}
  </span>
);

export const Alert = ({ children, severity, sx, style, ...rest }: AnyProps) => (
  <div role="alert" data-severity={severity} {...rest} style={mergeStyle(style, sx)}>
    {children}
  </div>
);
export const AlertTitle = ({ children, ...rest }: AnyProps) => <strong {...rest}>{children}</strong>;
export const Divider = ({ ...rest }: AnyProps) => <hr {...rest} />;

export const CircularProgress = (props: AnyProps) => <span role="progressbar" {...props} />;

export const Backdrop = ({ open, children, sx, style, ...rest }: AnyProps) => {
  if (!open) return null;
  return (
    <div {...rest} style={mergeStyle(style, sx)}>
      {children}
    </div>
  );
};

export const FormGroup = Paper;

export const FormControlLabel = ({ control, label, ...rest }: AnyProps) => (
  <label {...rest}>
    {control}
    {label}
  </label>
);

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

export const InputAdornment = ({ children, ...rest }: AnyProps) => <span {...rest}>{children}</span>;

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

export const List = Paper;
export const ListItem = Paper;
export const ListItemButton = Button;
export const ListItemText = ({ primary, secondary, ...rest }: AnyProps) => (
  <span {...rest}>
    {primary}
    {secondary}
  </span>
);
export const ListItemIcon = ({ children, ...rest }: AnyProps) => <span {...rest}>{children}</span>;

export const Skeleton = ({ component, sx, style, ...rest }: AnyProps) => {
  const Component = asElement(component, "div");
  return <Component aria-hidden="true" {...rest} style={mergeStyle(style, sx)} />;
};

export const Tooltip = ({ title, children, ...rest }: AnyProps) => (
  <span title={typeof title === "string" ? title : undefined} {...rest}>
    {children}
  </span>
);

export const Menu = ({ open, children, onClose, ...rest }: AnyProps) => {
  if (!open) return null;
  return (
    <div {...rest}>
      <button type="button" onClick={onClose} aria-label="Close menu" />
      {children}
    </div>
  );
};

export const MenuItem = ({ children, onClick, ...rest }: AnyProps) => (
  <button type="button" {...rest} onClick={onClick}>
    {children}
  </button>
);

const modalBackdropStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.4)",
  zIndex: 1300,
};

const dialogPopupStyle: React.CSSProperties = {
  position: "fixed",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  zIndex: 1400,
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  boxShadow: "0 18px 45px rgba(15, 23, 42, 0.22)",
  padding: 16,
  maxWidth: "min(640px, calc(100vw - 32px))",
  maxHeight: "calc(100vh - 32px)",
  overflow: "auto",
};

function drawerPopupStyle(anchor: string | undefined): React.CSSProperties {
  const side = anchor || "left";
  const base: React.CSSProperties = {
    position: "fixed",
    zIndex: 1400,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 18px 45px rgba(15, 23, 42, 0.22)",
    overflow: "auto",
    maxWidth: "100vw",
    maxHeight: "100vh",
  };

  if (side === "right") return { ...base, top: 0, right: 0, bottom: 0 };
  if (side === "top") return { ...base, top: 0, left: 0, right: 0 };
  if (side === "bottom") return { ...base, left: 0, right: 0, bottom: 0 };
  return { ...base, top: 0, left: 0, bottom: 0 };
}

export const Dialog = ({ open, onClose, children, style, sx, ...rest }: AnyProps) => (
  <BaseDialog.Root open={open} onOpenChange={(next: boolean) => !next && onClose?.()}>
    <BaseDialog.Portal>
      <BaseDialog.Backdrop style={modalBackdropStyle} />
      <BaseDialog.Popup {...rest} style={mergeStyle({ ...dialogPopupStyle, ...style }, sx)}>
        {children}
      </BaseDialog.Popup>
    </BaseDialog.Portal>
  </BaseDialog.Root>
);

export const DialogTitle = ({ children, ...rest }: AnyProps) => <h2 {...rest}>{children}</h2>;
export const DialogContent = ({ children, ...rest }: AnyProps) => <div {...rest}>{children}</div>;
export const DialogContentText = ({ children, ...rest }: AnyProps) => <p {...rest}>{children}</p>;
export const DialogActions = ({ children, ...rest }: AnyProps) => <div {...rest}>{children}</div>;

export const Drawer = ({ open, onClose, children, hideBackdrop, anchor, style, sx, ...rest }: AnyProps) => (
  <BaseDrawer.Root open={open} onOpenChange={(next: boolean) => !next && onClose?.()}>
    <BaseDrawer.Portal>
      {!hideBackdrop ? <BaseDrawer.Backdrop style={modalBackdropStyle} /> : null}
      <BaseDrawer.Popup {...rest} style={mergeStyle({ ...drawerPopupStyle(anchor), ...style }, sx)}>
        {children}
      </BaseDrawer.Popup>
    </BaseDrawer.Portal>
  </BaseDrawer.Root>
);

export default {
  ThemeProvider,
  createTheme,
};
