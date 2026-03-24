import { Dialog as BaseDialog } from "@base-ui/react";
import type { ComponentPropsWithoutRef } from "react";
import type React from "react";
import { X } from "lucide-react";
import { cn } from "@/utils/cn";

export const DialogClose = BaseDialog.Close;

export interface DialogProps extends Omit<ComponentPropsWithoutRef<"div">, "onClose"> {
  open?: boolean;
  onClose?: () => void;
}

export function Dialog({ open, onClose, className, children, ...rest }: DialogProps) {
  return (
    <BaseDialog.Root open={open} onOpenChange={(next: boolean) => !next && onClose?.()}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="fixed inset-0 z-[1300] bg-slate-900/30 backdrop-blur-sm transition-opacity duration-200 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0" />
        <BaseDialog.Popup
          className={cn(
            "fixed z-[1400] overflow-auto bg-white shadow-2xl dark:bg-[#1a1a1a]",
            "inset-0 max-h-screen w-full rounded-none border-0",
            "sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-h-[calc(100vh-32px)] sm:w-[min(640px,calc(100vw-32px))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border sm:border-slate-200 sm:dark:border-[#2a2a2a]",
            "transition-[opacity,transform] duration-200 data-[starting-style]:opacity-0 sm:data-[starting-style]:scale-95 data-[ending-style]:opacity-0 sm:data-[ending-style]:scale-95",
            className
          )}
          {...rest}
        >
          {children}
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}

export interface DialogHeaderProps {
  title: React.ReactNode;
  closeAriaLabel?: string;
}

export function DialogHeader({ title, closeAriaLabel = "Close" }: DialogHeaderProps) {
  return (
    <div className="flex items-center justify-between px-6 pb-2 pt-6">
      <h2 className="text-xl font-bold text-slate-900 dark:text-white">{title}</h2>
      <DialogClose
        aria-label={closeAriaLabel}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-transparent p-0 text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-[#2a2a2a]"
      >
        <X className="h-5 w-5" />
      </DialogClose>
    </div>
  );
}

type DialogTitleProps = ComponentPropsWithoutRef<"h2">;
type DialogContentProps = ComponentPropsWithoutRef<"div">;
type DialogContentTextProps = ComponentPropsWithoutRef<"p">;
type DialogActionsProps = ComponentPropsWithoutRef<"div">;

export function DialogTitle({ children, className, ...rest }: DialogTitleProps) {
  return (
    <h2 className={cn("px-6 pb-1 pt-6 text-xl font-bold text-slate-900 dark:text-white", className)} {...rest}>
      {children}
    </h2>
  );
}

export function DialogContent({ children, className, ...rest }: DialogContentProps) {
  return (
    <div className={cn("px-6 py-4", className)} {...rest}>
      {children}
    </div>
  );
}

export function DialogContentText({ children, className, ...rest }: DialogContentTextProps) {
  return (
    <p className={cn("text-sm text-slate-600 dark:text-slate-400", className)} {...rest}>
      {children}
    </p>
  );
}

export function DialogActions({ children, className, ...rest }: DialogActionsProps) {
  return (
    <div className={cn("flex items-center justify-end gap-2 px-6 pb-6 pt-2", className)} {...rest}>
      {children}
    </div>
  );
}
