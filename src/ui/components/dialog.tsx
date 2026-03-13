import * as React from "react";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { cn } from "../lib/cn";

export function Dialog({ open, onOpenChange, children }: BaseDialog.Root.Props) {
  return (
    <BaseDialog.Root open={open} onOpenChange={onOpenChange}>
      {children}
    </BaseDialog.Root>
  );
}

export function DialogTrigger(props: BaseDialog.Trigger.Props) {
  return <BaseDialog.Trigger {...props} />;
}

export function DialogPortal(props: BaseDialog.Portal.Props) {
  return <BaseDialog.Portal {...props} />;
}

export function DialogBackdrop({ className, ...props }: BaseDialog.Backdrop.Props) {
  return <BaseDialog.Backdrop className={cn("fixed inset-0", className)} {...props} />;
}

export function DialogContent({ className, ...props }: BaseDialog.Popup.Props) {
  return <BaseDialog.Popup className={cn("fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2", className)} {...props} />;
}

export function DialogTitle(props: BaseDialog.Title.Props) {
  return <BaseDialog.Title {...props} />;
}

export function DialogDescription(props: BaseDialog.Description.Props) {
  return <BaseDialog.Description {...props} />;
}

export function DialogClose(props: BaseDialog.Close.Props) {
  return <BaseDialog.Close {...props} />;
}
