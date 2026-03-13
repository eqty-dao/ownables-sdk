import * as React from "react";
import { Menu as BaseMenu } from "@base-ui/react/menu";
import { cn } from "./lib/cn";

export function MenuRoot(props: BaseMenu.Root.Props<unknown>) {
  return <BaseMenu.Root {...props} />;
}

export function MenuTrigger(props: BaseMenu.Trigger.Props) {
  return <BaseMenu.Trigger {...props} />;
}

export function MenuPortal(props: BaseMenu.Portal.Props) {
  return <BaseMenu.Portal {...props} />;
}

export function MenuPositioner(props: BaseMenu.Positioner.Props) {
  return <BaseMenu.Positioner {...props} />;
}

export function MenuPopup({ className, ...props }: BaseMenu.Popup.Props) {
  return <BaseMenu.Popup className={cn("min-w-[8rem]", className)} {...props} />;
}

export function MenuItem({ className, ...props }: BaseMenu.Item.Props) {
  return <BaseMenu.Item className={cn("cursor-default", className)} {...props} />;
}

export function MenuSeparator(props: BaseMenu.Separator.Props) {
  return <BaseMenu.Separator {...props} />;
}
