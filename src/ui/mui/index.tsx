import React, { forwardRef } from "react";
import { Dialog as BaseDialog, Drawer as BaseDrawer, Switch as BaseSwitch } from "@base-ui/react";

type AnyProps = Record<string, any>;

export type AlertColor = "success" | "info" | "warning" | "error" | "primary" | "secondary";
export type BoxProps = AnyProps;
export type SxProps<T = unknown> = any;
export type Theme = any;
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

function asElement(component: any, fallback: any) {
  return component || fallback;
}

export const ThemeProvider = ({ children }: AnyProps) => <>{children}</>;
export const createTheme = (theme: AnyProps) => ({ ...fakeTheme, ...theme });

export function styled(Component: any) {
  return (styles: any) => {
    const Styled = forwardRef<any, AnyProps>((props, ref) => {
      const styleObj = typeof styles === "function" ? styles({ theme: fakeTheme }) : styles;
      return <Component ref={ref} {...props} style={mergeStyle(props.style, styleObj)} />;
    });
    Styled.displayName = `Styled(${Component.displayName || Component.name || "Component"})`;
    return Styled;
  };
}

export const Box = forwardRef<any, AnyProps>(function Box({ component, sx, style, ...rest }, ref) {
  const Component = asElement(component, "div");
  return <Component ref={ref} {...rest} style={mergeStyle(style, sx)} />;
});

export const Stack = forwardRef<any, AnyProps>(function Stack({ component, sx, style, ...rest }, ref) {
  const Component = asElement(component, "div");
  return <Component ref={ref} {...rest} style={mergeStyle(style, sx)} />;
});

export const Grid = forwardRef<any, AnyProps>(function Grid({ component, sx, style, ...rest }, ref) {
  const Component = asElement(component, "div");
  return <Component ref={ref} {...rest} style={mergeStyle(style, sx)} />;
});

export const Typography = forwardRef<any, AnyProps>(function Typography(
  { component, variant, sx, style, children, ...rest },
  ref
) {
  const fallback = variant && String(variant).startsWith("h") ? variant : "span";
  const Component = asElement(component, fallback);
  return (
    <Component ref={ref} {...rest} style={mergeStyle(style, sx)}>
      {children}
    </Component>
  );
});

export const Link = forwardRef<any, AnyProps>(function Link({ sx, style, ...rest }, ref) {
  return <a ref={ref} {...rest} style={mergeStyle(style, sx)} />;
});

export const Button = forwardRef<any, AnyProps>(function Button({ sx, style, type = "button", ...rest }, ref) {
  return <button ref={ref} type={type} {...rest} style={mergeStyle(style, sx)} />;
});

export const IconButton = forwardRef<any, AnyProps>(function IconButton(props, ref) {
  return <Button ref={ref} {...props} />;
});

export const ButtonBase = forwardRef<any, AnyProps>(function ButtonBase(props, ref) {
  return <Button ref={ref} {...props} />;
});

export const Fab = forwardRef<any, AnyProps>(function Fab(props, ref) {
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

export const Switch = forwardRef<any, AnyProps>(function Switch({ checked, onChange, ...rest }, ref) {
  return (
    <BaseSwitch.Root
      ref={ref}
      checked={checked}
      onCheckedChange={(next: boolean) => onChange?.({ target: { checked: next } })}
      {...rest}
    >
      <BaseSwitch.Thumb />
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

export const Dialog = ({ open, onClose, children, ...rest }: AnyProps) => (
  <BaseDialog.Root open={open} onOpenChange={(next: boolean) => !next && onClose?.()}>
    <BaseDialog.Portal>
      <BaseDialog.Backdrop />
      <BaseDialog.Popup {...rest}>{children}</BaseDialog.Popup>
    </BaseDialog.Portal>
  </BaseDialog.Root>
);

export const DialogTitle = ({ children, ...rest }: AnyProps) => <h2 {...rest}>{children}</h2>;
export const DialogContent = ({ children, ...rest }: AnyProps) => <div {...rest}>{children}</div>;
export const DialogContentText = ({ children, ...rest }: AnyProps) => <p {...rest}>{children}</p>;
export const DialogActions = ({ children, ...rest }: AnyProps) => <div {...rest}>{children}</div>;

export const Drawer = ({ open, onClose, children, hideBackdrop, ...rest }: AnyProps) => (
  <BaseDrawer.Root open={open} onOpenChange={(next: boolean) => !next && onClose?.()}>
    <BaseDrawer.Portal>
      {!hideBackdrop ? <BaseDrawer.Backdrop /> : null}
      <BaseDrawer.Popup {...rest}>{children}</BaseDrawer.Popup>
    </BaseDrawer.Portal>
  </BaseDrawer.Root>
);

export default {
  ThemeProvider,
  createTheme,
};
