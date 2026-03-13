import * as React from "react";
import { Select as BaseSelect } from "@base-ui/react/select";
import { cn } from "./lib/cn";

export function SelectRoot<Value>(props: BaseSelect.Root.Props<Value>) {
  return <BaseSelect.Root {...props} />;
}

export function SelectTrigger({ className, ...props }: BaseSelect.Trigger.Props) {
  return <BaseSelect.Trigger className={cn("inline-flex items-center justify-between gap-2", className)} {...props} />;
}

export function SelectValue(props: BaseSelect.Value.Props) {
  return <BaseSelect.Value {...props} />;
}

export function SelectPortal(props: BaseSelect.Portal.Props) {
  return <BaseSelect.Portal {...props} />;
}

export function SelectPositioner(props: BaseSelect.Positioner.Props) {
  return <BaseSelect.Positioner {...props} />;
}

export function SelectPopup({ className, ...props }: BaseSelect.Popup.Props) {
  return <BaseSelect.Popup className={cn("min-w-[8rem]", className)} {...props} />;
}

export function SelectList(props: BaseSelect.List.Props) {
  return <BaseSelect.List {...props} />;
}

export function SelectItem<Value>({ className, ...props }: BaseSelect.Item.Props<Value>) {
  return <BaseSelect.Item className={cn("cursor-default", className)} {...props} />;
}

export function SelectItemText(props: BaseSelect.ItemText.Props) {
  return <BaseSelect.ItemText {...props} />;
}
