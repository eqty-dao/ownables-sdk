import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { Button } from "./button";
import { cn } from "@/utils/cn"

type ListProps = ComponentPropsWithoutRef<"div">;
type ListItemProps = ComponentPropsWithoutRef<"div">;
type ListItemTextProps = Omit<ComponentPropsWithoutRef<"div">, "children"> & {
  primary?: ReactNode;
  secondary?: ReactNode;
};
type ListItemIconProps = ComponentPropsWithoutRef<"span">;

export function List({ children, className, ...rest }: ListProps) {
  return <div className={cn("flex flex-col gap-1", className)} {...rest}>{children}</div>;
}

export function ListItem({ children, className, ...rest }: ListItemProps) {
  return <div className={cn("flex items-center gap-3", className)} {...rest}>{children}</div>;
}

export const ListItemButton = Button;

export function ListItemText({ primary, secondary, className, ...rest }: ListItemTextProps) {
  return (
    <div className={cn('min-w-0 flex-1', className)} {...rest}>
      <div className="truncate text-sm font-medium">{primary}</div>
      {secondary && (<div className="text-xs">{secondary}</div>) }
    </div>
  );
}

export function ListItemIcon({ children, className, ...rest }: ListItemIconProps) {
  return <span className={cn("flex shrink-0 items-center justify-center pt-0.5", className)} {...rest}>{children}</span>;
}
