import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { Button } from "./button";

type ListProps = ComponentPropsWithoutRef<"div">;
type ListItemProps = ComponentPropsWithoutRef<"div">;
type ListItemTextProps = Omit<ComponentPropsWithoutRef<"span">, "children"> & {
  primary?: ReactNode;
  secondary?: ReactNode;
};
type ListItemIconProps = ComponentPropsWithoutRef<"span">;

export function List({ children, ...rest }: ListProps) {
  return <div {...rest}>{children}</div>;
}

export function ListItem({ children, ...rest }: ListItemProps) {
  return <div {...rest}>{children}</div>;
}

export const ListItemButton = Button;

export function ListItemText({ primary, secondary, ...rest }: ListItemTextProps) {
  return (
    <span {...rest}>
      {primary}
      {secondary}
    </span>
  );
}

export function ListItemIcon({ children, ...rest }: ListItemIconProps) {
  return <span {...rest}>{children}</span>;
}
