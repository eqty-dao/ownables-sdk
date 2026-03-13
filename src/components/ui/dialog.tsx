import * as React from "react";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { cn } from "./lib/cn";

export interface DialogProps {
  children: React.ReactNode;
  className?: string;
  onClose?: () => void;
  open?: boolean;
}

export function Dialog({ open, onClose, className, children }: DialogProps) {
  return (
    <BaseDialog.Root open={open} onOpenChange={(next) => !next && onClose?.()}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="fixed inset-0 z-[1300] bg-slate-900/40" />
        <BaseDialog.Popup
          className={cn(
            "fixed left-1/2 top-1/2 z-[1400] max-h-[calc(100vh-32px)] w-[min(640px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-xl border border-slate-200 bg-white p-4 shadow-xl",
            className
          )}
        >
          {children}
        </BaseDialog.Popup>
      </BaseDialog.Portal>
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
  return <div className={cn("pt-2", className)} {...props} />;
}

export function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-lg font-semibold", className)} {...props} />;
}

export function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-slate-600", className)} {...props} />;
}

export function DialogClose(props: BaseDialog.Close.Props) {
  return <BaseDialog.Close {...props} />;
}

export function DialogActions({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mt-4 flex items-center justify-end gap-2", className)} {...props} />;
}

export function DialogContentText({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-slate-600", className)} {...props} />;
}
