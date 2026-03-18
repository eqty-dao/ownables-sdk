import type { AnyProps } from "./types";
import { Button } from "./button";

export function List({ children, ...rest }: AnyProps) {
  return <div {...rest}>{children}</div>;
}

export function ListItem({ children, ...rest }: AnyProps) {
  return <div {...rest}>{children}</div>;
}

export const ListItemButton = Button;

export function ListItemText({ primary, secondary, ...rest }: AnyProps) {
  return (
    <span {...rest}>
      {primary}
      {secondary}
    </span>
  );
}

export function ListItemIcon({ children, ...rest }: AnyProps) {
  return <span {...rest}>{children}</span>;
}
